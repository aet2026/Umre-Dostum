#!/data/data/com.termux/files/usr/bin/bash
# Kullanım: ./dump.sh [proje_dizini] [cikis_dizini]
# Örnek:   ./dump.sh . ./project_dump

export LC_ALL=C                       # ${#var} = bayt sayısı

PROJECT_DIR="${1:-.}"
OUTPUT_DIR="${2:-./project_dump}"
MAX_SIZE=$((100 * 1024))              # 100 KB

mkdir -p "$OUTPUT_DIR"
PROJECT_DIR=$(cd "$PROJECT_DIR" && pwd)
OUTPUT_DIR=$(cd "$OUTPUT_DIR" && pwd)

rm -f "$OUTPUT_DIR"/*.txt

LIST=$(mktemp)
find "$PROJECT_DIR" \
  \( -type d \( -name node_modules -o -name .git \
                -o -name dist -o -name coverage \) -prune \) -o \
  \( -type f -print \) 2>/dev/null | sort > "$LIST"

part=1
out="$OUTPUT_DIR/p${part}.txt"
: > "$out"
current_size=0

new_part() {
  part=$((part+1))
  out="$OUTPUT_DIR/p${part}.txt"
  : > "$out"
  current_size=0
}

while IFS= read -r f; do
  case "$f" in "$OUTPUT_DIR"/*) continue ;; esac

  # boş olmayan binary dosyaları atla
  if [ -s "$f" ] && ! grep -qI . "$f" 2>/dev/null; then
    continue
  fi

  header="===== FILE: $f ====="
  footer="===== END:  $f ====="
  hsize=$(( ${#header} + 1 ))
  fsize=$(( ${#footer} + 1 ))

  if [ $(( current_size + hsize + fsize )) -gt "$MAX_SIZE" ]; then
    new_part
  fi

  printf '%s\n' "$header" >> "$out"
  current_size=$(( current_size + hsize ))

  while IFS= read -r line || [ -n "$line" ]; do
    lsize=$(( ${#line} + 1 ))
    if [ $(( current_size + lsize + fsize )) -gt "$MAX_SIZE" ]; then
      new_part
    fi
    printf '%s\n' "$line" >> "$out"
    current_size=$(( current_size + lsize ))
  done < "$f"

  if [ $(( current_size + fsize )) -gt "$MAX_SIZE" ]; then
    new_part
  fi
  printf '%s\n' "$footer" >> "$out"
  current_size=$(( current_size + fsize ))
done < "$LIST"

rm -f "$LIST"

echo "Bitti: $part parça → $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR"

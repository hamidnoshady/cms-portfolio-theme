#!/usr/bin/env bash
#
# Regenerates `public/qa/media/*.jpg` — the placeholder images the synthetic fixtures
# point at. They are **colour** on purpose: the design brief says photography keeps its
# colour while every surface, rule and type stays black on white, and that claim is only
# verifiable in browser evidence if the fixtures are not grayscale.
#
# They are obviously synthetic (flat colour fields plus a couple of geometric bands), so
# no one can mistake them for a customer's photography. Deterministic: same output for
# the same ImageMagick version, no randomness.
#
#   bash scripts/make-qa-media.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."
out=public/qa/media
mkdir -p "$out"

# name:geometry:sky:wall:accent — muted, architecture-adjacent palettes, one per image.
make_image() {
  local name=$1 size=$2 sky=$3 wall=$4 accent=$5
  convert -size "$size" \
    gradient:"$sky"-"$wall" \
    -fill "$accent" -draw "polygon 0,0 $(( ${size%x*} / 3 )),0 $(( ${size%x*} / 3 )),${size#*x} 0,${size#*x}" \
    -fill '#ffffff' -draw "rectangle 0,$(( ${size#*x} * 3 / 5 )),${size%x*},$(( ${size#*x} * 3 / 5 + 4 ))" \
    -fill '#00000020' -draw "rectangle 0,$(( ${size#*x} * 4 / 5 )),${size%x*},${size#*x}" \
    -quality 82 -strip "$out/$name"
}

make_image about-studio.jpg 1000x1300 '#c8d4dc' '#8e7f72' '#b5654a'
make_image block-01.jpg     1600x1067 '#dfe4e6' '#9aa7ad' '#4f6f79'
make_image education-01.jpg 1600x1067 '#e6dfd6' '#b9a68d' '#8a6d4f'
make_image education-02.jpg 1200x1600 '#d8dee2' '#93a3ab' '#3f5d68'
make_image gallery-01.jpg   1600x1067 '#e9e2d2' '#c2ad8a' '#a2683c'
make_image gallery-02.jpg   1200x1600 '#cfd8d6' '#7f9a94' '#38625c'
make_image gallery-03.jpg   1000x1000 '#e3e0e6' '#a496a8' '#6b4f70'
make_image note-01.jpg      1600x1067 '#e8e6e1' '#b6b1a6' '#7a736b'
make_image project-01.jpg   1600x1067 '#c9d6de' '#7d8b95' '#2f4b57'
make_image project-02.jpg   1200x1600 '#e6ded4' '#b09a83' '#8d5a35'
make_image project-03.jpg   1600x1067 '#d5dcd8' '#88968d' '#3d5b48'
make_image project-04.jpg   1000x1000 '#e2dcd0' '#a99a80' '#75592f'
make_image project-05.jpg   1200x1600 '#d3d8e0' '#828b9e' '#3b4a6b'
make_image project-06.jpg   1600x1067 '#eadfd8' '#c0a191' '#8c4a34'

echo "wrote $(ls -1 "$out"/*.jpg | wc -l) placeholder images into $out"

#!/bin/sh
# Opdaterer Flow Cards fra GitHub. Rører kun mappen custom_components/flow_cards.
set -e
rm -rf /tmp/fc
git clone --depth 1 https://github.com/amigoogfutte/Flow_cards /tmp/fc
cp -r /tmp/fc/custom_components/flow_cards /config/custom_components/
rm -rf /tmp/fc
echo ""
echo "Flow Cards er opdateret til version: $(grep '"version"' /config/custom_components/flow_cards/manifest.json | cut -d'"' -f4)"
echo "Genstart nu Home Assistant: Indstillinger -> System -> Genstart"

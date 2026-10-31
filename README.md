# Flow Cards – Homey-agtige flows i Home Assistant

Et **Flows**-panel i Home Assistants sidemenu, hvor du bygger flows af kort:

- **NÅR…** noget sker (knaptryk, lys tændes, bevægelse, klokkeslæt, solnedgang, en hændelse …)
- **OG…** betingelserne passer (alle eller én af dem, og hvert kort kan vendes med **IKKE**)
- **SÅ…** gør Home Assistant noget (tænd/dæmp lys, gardiner, beskeder, vent, start andre flows …)
- **ELLERS…** hvis betingelserne ikke passer

Flowene køres af en flow-motor inde i Home Assistant. De er altså ikke almindelige HA-automationer.

## Opdateringer

Fra version 0.5 finder Home Assistant selv nye versioner. De dukker op under **Indstillinger → Opdateringer** som "Flow Cards". Tryk **Installér**, og genstart derefter Home Assistant. Øverst i Flows kan du se, hvilken version du kører, og om der mangler en genstart.

## Installation

1. Kopiér mappen `custom_components/flow_cards` til `/config/custom_components/flow_cards` på din Home Assistant. Det kan gøres med Samba share, File editor eller Studio Code Server.
2. Genstart Home Assistant.
3. Gå til **Indstillinger → Enheder og tjenester → Tilføj integration** og søg efter **Flow Cards**.
4. Panelet **Flows** dukker op i sidemenuen (kun for administratorer). Lav en hård genindlæsning af browseren (Ctrl+F5), hvis det ikke vises.

## Sådan bruges det

- **Nyt flow**: Klik på *Tilføj kort* i en kolonne. Vælg derefter en enhed (grupperet efter område) eller en indbygget "app": Dato & tid, Sol, Logik, Notifikationer, Flows, Hændelser, Home Assistant eller Avanceret.
- **Kort**: Klik på et kort for at redigere det. Træk i kortene for at ændre rækkefølgen. Under OG kan du klikke **IKKE** for at vende en betingelse om.
- **Ved ny udløsning**: *Ignorér nye* (standard), *Genstart* eller *Kør parallelt*. *Genstart* + *Vent 3 min* + *Sluk* giver et klassisk bevægelses-timer-flow, svarende til "trigger 3min" i Node-RED.
- **Test** gemmer og kører flowet med det samme. Kortene får ✓, ✕ eller ! efter, hvordan de gik.
- **Historik** viser de seneste 30 kørsler pr. flow, med hvert trin, varighed og fejlbeskeder.
- Tekstfelter i SÅ-kort kan bruge skabeloner, f.eks. `{{ trigger.description }}` eller `{{ states('sensor.x') }}`.

## Avancerede flows (0.2)

Tryk **Nyt flow → Avanceret flow**. Du kan også lave et almindeligt flow om med **Gør avanceret**.

- **Frit lærred**: træk kortene rundt, panorér med en finger, zoom med knib, scrollhjul eller − / +, og tryk **Tilpas** for at se det hele.
- **Ledninger**: træk fra den runde udgang på et kort over på det næste kort. På mobilen kan du også *trykke* på udgangen og derefter på kortet. Tryk på en ledning for at fjerne den.
- **OG-kort** har to udgange: grøn ✓ (sand) og rød ✕ (falsk).
- **SÅ-kort** har en ekstra orange **!**-udgang, der bruges, hvis kortet fejler, f.eks. hvis en lampe er utilgængelig.
- **Logik**: *Alle* fortsætter først, når alle ledninger ind til kortet er nået frem. *Én af* fortsætter ved den første. *Note* er en gul seddel til forklaringer.
- **▶ på et NÅR-kort** tester flowet fra netop det kort. NÅR-kortet *Flowet startes manuelt* (under Flows) bestemmer, hvor **Test** starter.
- Grene kører samtidig. *Stop flowet* stopper alle grene. Et flow stopper efter 200 kort, så en løkke ikke kan køre for evigt.

## Importér fra Node-RED (0.3)

Knappen **Importér fra Node-RED** henter fanerne direkte fra Node-RED-appen. Du kan også indsætte en eksport.
- Hver fane bliver en mappe, og hver selvstændig kæde bliver et avanceret flow med samme layout som i Node-RED.
- Tilstandsændringer, knapper, tidspunkter (cron), interval, sol, aktuel tilstand, switch, tidsrum, ugedage, delay, trigger-noder, link-noder og tjenestekald bliver oversat.
- Noder, der ikke kan oversættes (function, gate, template, ha-device osv.), bliver til gule noter på lærredet.
- Flowene oprettes slået fra. **Skift over** slår fanerne fra i Node-RED og flowene til her, og samme knap kan fortryde det igen.

## Nyt i 0.4

- **Enhedskort:** Vælg en enhed, f.eks. en IKEA-puk, under NÅR, og få dens knapper og hændelser som kort ("Sender “Tænd”", "Lysstyrke op (hold)" …). Det bruger Home Assistants egne enheds-triggere, så det virker med Zigbee2MQTT, ZHA, BTHome osv.
- **Tal-kort med varighed:** "Bliver under 30 % *i 10 min*".
- **Flere entiteter i ét NÅR-kort:** Avanceret → "ændrer tilstand", f.eks. 46 enheder, der bliver *unavailable* i 10 min.
- **Lys:** "Gør lysere med X %" og "Gør mørkere med X %".
- **Højttalere:** "Sig …" på enhver medieafspiller via tekst-til-tale.
- **Node-RED-import:** ha-device-knapper, "mindre/større end"-triggere og store entitetslister bliver nu oversat.

## Data

- Flows gemmes i `/config/.storage/flow_cards.flows` og historik i `/config/.storage/flow_cards.history`. Begge kommer med i HA's sikkerhedskopier.
- Du kan slå integrationen fra under Enheder og tjenester. Så stopper alle flows uden at blive slettet.

## Ikke med endnu


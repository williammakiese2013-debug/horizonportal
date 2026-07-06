// story.js
// Contenu narratif du Mode Histoire : "LE FIL DE PRIME"
//
// Structure de chaque chapitre :
//   { id, title, steps: [ ... ] }
// Un "step" peut être :
//   - { type: 'narration', lines: [{ speaker, text }, ...] }
//   - { type: 'tutorial', text, minDistance }
//   - { type: 'combat', text, waves: [{ type: 'grunt'|'elite'|'monster', count }] }
//   - { type: 'travel', text, poiKey, radius }            — rejoindre un lieu (compas de quête)
//   - { type: 'infiltration', text, poiKey, consoleRadius, alarmWave } — approche discrète, caméras/suspicion
//   - { type: 'hacking', text, poiKey, failWave }          — mini-jeu de piratage de terminal
//   - { type: 'boss', text, enemyType: 'boss' }

const N = 'Narrateur';
const HERO = 'Toi';
const VOSS = 'Dr Elara Voss';
const PRIME = 'Prime';

export const STORY = [
  {
    id: 'prologue',
    title: 'Prologue — Naissance',
    steps: [
      {
        type: 'narration',
        lines: [
          { speaker: N, text: "Il y a une semaine, tu n'étais personne de particulier. Un simple visiteur au mauvais endroit, au mauvais moment, dans les laboratoires de Meridian Biotech." },
          { speaker: N, text: "Une effraction, une cuve d'essai brisée, un sérum expérimental répandu sur ta peau. Tu aurais dû mourir cette nuit-là. Au lieu de ça, tu t'es réveillé changé." },
          { speaker: HERO, text: "Une force nouvelle. Des réflexes impossibles. Et ce fil, jailli de mes propres mains, capable de me porter au-dessus de la ville entière." },
          { speaker: N, text: "Ce pouvoir n'est pas un cadeau. C'est une question, posée chaque jour : qu'en feras-tu ? Avant de répondre, apprends d'abord à simplement tenir debout dans ce nouveau corps." },
        ],
      },
      {
        type: 'tutorial',
        text: "Déplace-toi (ZQSD), saute (Espace), puis vise un immeuble et tire une toile pour t'élancer.",
        minDistance: 18,
      },
      {
        type: 'narration',
        lines: [
          { speaker: N, text: "Voilà. Le vertige s'efface, le contrôle vient. La ville, en bas, ne sait pas encore que quelque chose a changé. Elle va bientôt l'apprendre." },
        ],
      },
    ],
  },

  {
    id: 'ch1',
    title: 'Chapitre 1 — Les rues n\'oublient pas',
    steps: [
      {
        type: 'narration',
        lines: [
          { speaker: N, text: "Les premières nuits, tu erres sans but, cherchant un sens à ce que tu es devenu. Puis tu entends les sirènes, les cris, et quelque chose en toi refuse de détourner le regard." },
          { speaker: HERO, text: "Si j'ai reçu cette force par accident, je peux au moins décider de ce que j'en fais maintenant." },
        ],
      },
      {
        type: 'combat',
        text: 'Neutralise les voyous qui terrorisent le quartier',
        waves: [
          { type: 'grunt', count: 3 },
          { type: 'grunt', count: 2 },
        ],
      },
      {
        type: 'narration',
        lines: [
          { speaker: N, text: "Le quartier respire à nouveau. Mais en fouillant les lieux, tu remarques un détail qui te glace : chaque voyou porte, tatoué sur l'avant-bras, le même symbole. Celui de Meridian Biotech." },
          { speaker: HERO, text: "L'entreprise qui m'a changé... arme aussi les rues ? Ça ne peut pas être une coïncidence." },
        ],
      },
    ],
  },

  {
    id: 'ch2-datacenter',
    title: 'Chapitre 2 — Ce que les données savent',
    steps: [
      {
        type: 'narration',
        lines: [
          { speaker: HERO, text: "Le tatouage Meridian sur chaque voyou n'est pas une coïncidence. Il me faut des preuves, pas des suppositions. Meridian possède un central de données en périphérie, à peine gardé — personne ne s'attend à une intrusion depuis les toits." },
          { speaker: N, text: "Pas besoin de défoncer une porte : un simple terminal extérieur, mal sécurisé, suffira pour fouiller leurs serveurs. Encore faut-il l'atteindre, et le pirater sans se faire repérer." },
        ],
      },
      {
        type: 'travel',
        text: 'Rejoins le Central de Données Meridian (repère à l\'écran)',
        poiKey: 'dataCenter',
        radius: 16,
      },
      {
        type: 'narration',
        lines: [
          { speaker: HERO, text: "Des caméras balaient le site. Rien d'insurmontable, mais autant rester discret : mieux vaut éviter que la moitié de la milice de Meridian rapplique pendant que je fouille leurs fichiers." },
        ],
      },
      {
        type: 'infiltration',
        text: 'Approche le terminal sans attirer l\'attention des caméras',
        poiKey: 'dataCenter',
        consoleRadius: 4,
        alarmWave: 2,
      },
      {
        type: 'hacking',
        text: 'Pirate le terminal pour accéder aux serveurs Meridian',
        poiKey: 'dataCenter',
        failWave: 2,
      },
      {
        type: 'narration',
        lines: [
          { speaker: N, text: "Les journaux d'expédition parlent de \"cargaisons biologiques\" envoyées chaque semaine vers un entrepôt des Docks, sous couvert de matériel médical. Une adresse est surlignée en rouge, comme une priorité." },
          { speaker: HERO, text: "Des cargaisons biologiques qui ne passent jamais par la douane normale... Il faut que j'aille voir ça de mes propres yeux." },
        ],
      },
    ],
  },

  {
    id: 'ch3-docks',
    title: 'Chapitre 3 — Sous couvert de nuit',
    steps: [
      {
        type: 'travel',
        text: 'Rejoins les Docks Meridian (repère à l\'écran)',
        poiKey: 'docks',
        radius: 18,
      },
      {
        type: 'narration',
        lines: [
          { speaker: N, text: "Les docks grouillent de caméras et de projecteurs mobiles. Un vrai entrepôt sous surveillance, pas un simple quai de marchandises. Ce que Meridian planque ici doit valoir cher — ou être très illégal. Sans doute les deux." },
        ],
      },
      {
        type: 'infiltration',
        text: 'Infiltre les Docks jusqu\'au poste de contrôle des conteneurs',
        poiKey: 'docks',
        consoleRadius: 4,
        alarmWave: 3,
      },
      {
        type: 'hacking',
        text: 'Détourne le système pour ouvrir le registre des conteneurs',
        poiKey: 'docks',
        failWave: 3,
      },
      {
        type: 'narration',
        lines: [
          { speaker: N, text: "Le registre détourné révèle tout : des dizaines de \"sujets\" listés comme de la marchandise, embarqués vers des acheteurs anonymes à l'étranger. Chaque ligne porte la même signature de validation : Dr Elara Voss." },
          { speaker: HERO, text: "Ce n'est plus une expérience qui a mal tourné. C'est une chaîne de production. Et je viens d'en trouver la responsable." },
        ],
      },
    ],
  },

  {
    id: 'ch4',
    title: 'Chapitre 4 — Sous la ville',
    steps: [
      {
        type: 'narration',
        lines: [
          { speaker: HERO, text: "Voss. Ce nom revient partout : les serveurs du central de données, le registre des docks... et maintenant des habitants qui disparaissent près des entrepôts désaffectés, à la lisière de la ville." },
          { speaker: N, text: "La police évite le secteur. Toi, tu t'y rends directement. L'air y est différent, chargé d'une odeur chimique âcre. Et dans l'ombre entre deux tours, quelque chose respire qui n'est plus tout à fait humain." },
        ],
      },
      {
        type: 'combat',
        text: 'Affronte la créature qui rôde dans le secteur',
        waves: [{ type: 'monster', count: 1 }],
      },
      {
        type: 'narration',
        lines: [
          { speaker: HERO, text: "Ce visage... sous les mutations, il y avait encore un visage humain. Ce n'est pas un monstre né comme ça. On l'a transformé en ça." },
          { speaker: N, text: "Sur le sol, un badge d'accès fondu à moitié dans la chair de la créature porte encore un nom lisible : Programme Chimère. Et une signature, en bas du document : Dr Elara Voss." },
        ],
      },
    ],
  },

  {
    id: 'ch5',
    title: 'Chapitre 5 — Le prix du silence',
    steps: [
      {
        type: 'narration',
        lines: [
          { speaker: N, text: "Le badge fondu trouvé sur la créature — Programme Chimère, signé Voss — confirme ce que les serveurs et le registre des docks laissaient deviner. Une ancienne chercheuse en neuro-régénération, disparue des radars publics après un scandale étouffé, aujourd'hui officiellement sur des \"prothèses de nouvelle génération\"." },
          { speaker: HERO, text: "Officiellement. Mais une milice privée protège ses entrepôts. On ne cache pas des prothèses derrière des hommes armés." },
        ],
      },
      {
        type: 'combat',
        text: 'Perce les lignes de la milice privée de Meridian',
        waves: [
          { type: 'grunt', count: 3 },
          { type: 'elite', count: 1 },
        ],
      },
      {
        type: 'narration',
        lines: [
          { speaker: N, text: "Dans les dossiers saisis, une vérité dérangeante : les \"volontaires\" du Programme Chimère sont des sans-abris, des patients en fin de droits, des gens que personne ne réclamera. Voss n'a jamais cherché à soigner. Elle cherche à vendre une arme vivante au plus offrant." },
          { speaker: HERO, text: "Et le premier sujet réussi du programme, listé simplement sous le nom \"Prime\"... est gardé au dernier étage de la tour Meridian." },
        ],
      },
    ],
  },

  {
    id: 'ch6',
    title: 'Chapitre 6 — Ce que nous devenons',
    steps: [
      {
        type: 'narration',
        lines: [
          { speaker: N, text: "La tour Meridian domine la skyline, froide et silencieuse. Tu grimpes ses façades de verre, chaque étage plus hostile que le précédent." },
        ],
      },
      {
        type: 'combat',
        text: 'Franchis les gardiens Chimère du dernier étage',
        waves: [{ type: 'monster', count: 2 }],
      },
      {
        type: 'narration',
        lines: [
          { speaker: VOSS, text: "Je me demandais quand tu viendrais. Le premier accident de mon laboratoire, revenu me juger. Comme c'est... poétique." },
          { speaker: HERO, text: "Ce n'est pas un jugement, Voss. C'est la fin de votre programme." },
          { speaker: VOSS, text: "Mon programme ? Regarde-le d'abord, avant de me condamner. Regarde ce que ton propre sérum, perfectionné, peut accomplir. Je te présente Prime. Autrefois mon frère. Aujourd'hui, ma plus grande réussite." },
        ],
      },
      {
        type: 'boss',
        text: 'Affronte Prime',
        enemyType: 'boss',
      },
      {
        type: 'narration',
        lines: [
          { speaker: N, text: "Prime s'effondre. Sous la carapace fissurée, un instant, un regard humain refait surface — reconnaissant, avant de s'éteindre. Voss a disparu dans la confusion, emportant ses recherches, jurant dans l'ombre que ce n'est qu'un revers." },
          { speaker: HERO, text: "Elle recommencera ailleurs. Je le sais. Mais ce soir, cette ville respire un peu plus librement — et c'est déjà une réponse à la question qu'on m'a posée en me changeant." },
        ],
      },
    ],
  },
];

export const EPILOGUE_TITLE = 'Épilogue — Le fil qui nous relie';
export const EPILOGUE_TEXT =
  "Le pouvoir ne rend ni juste, ni bon : il rend seulement responsable. Voss court toujours, quelque part, avec d'autres sérums et d'autres ambitions. Mais tant qu'il restera un fil tendu entre les tours de cette ville, quelqu'un veillera. C'est la fin de ce premier chapitre de ton histoire — pas la fin de l'histoire elle-même.";

/* ============================================================
   Anime Catalog — BASE DE DONNÉES DES ANIMES
   ============================================================ */
const animeCatalog = {
  snk:{
    name:"Attack on Titan", emoji:"⚔️", color:"#2d5016",
    desc:"L'humanité se bat pour survivre face aux Titans, des créatures géantes dévoreuses d'hommes.",
    seasons:{
      1:{name:"Saison 1",episodes:25},
      2:{name:"Saison 2",episodes:12},
      3:{name:"Saison 3",episodes:22},
      4:{name:"Saison 4 Final",episodes:30}
    }
  },
  hxh:{
    name:"Hunter x Hunter", emoji:"🎯", color:"#1a5a2a",
    desc:"Gon Freecss découvre que son père est un Hunter légendaire et part sur ses traces.",
    seasons:{1:{name:"Série 2011 (6 arcs)",episodes:148}}
  },
  demonSlayer:{
    name:"Demon Slayer", emoji:"⚔️", color:"#1a4d2e",
    desc:"Tanjiro cherche un remède pour transformer sa sœur démon en humaine.",
    seasons:{
      1:{name:"Saison 1",episodes:26},
      2:{name:"Saison 2 Entertainment District",episodes:18},
      3:{name:"Saison 3 Swordsmith Village",episodes:11},
      4:{name:"Saison 4 Hashira Training",episodes:8}
    }
  },
  jjk:{
    name:"Jujutsu Kaisen", emoji:"👹", color:"#1a1a3a",
    desc:"Yuji Itadori avale un doigt maudit pour sauver ses amis.",
    seasons:{
      1:{name:"Saison 1",episodes:24},
      2:{name:"Saison 2",episodes:23}
    }
  },
  chainsawMan:{
    name:"Chainsaw Man", emoji:"🪓", color:"#8a1a1a",
    desc:"Denji fusionne avec son chien-démon Pochita pour devenir Chainsaw Man.",
    seasons:{1:{name:"Partie 1",episodes:12}}
  },
  vinlandSaga:{
    name:"Vinland Saga", emoji:"⚔️", color:"#2a3a5a",
    desc:"Thorfinn, fils d'un guerrier viking, cherche vengeance contre l'assassin de son père.",
    seasons:{
      1:{name:"Saison 1",episodes:24},
      2:{name:"Saison 2",episodes:24}
    }
  },
  onePiece:{
    name:"One Piece", emoji:"🏴‍☠️", color:"#d4202a",
    desc:"Luffy et son équipage cherchent le One Piece, le trésor ultime.",
    seasons:{1:{name:"Films",episodes:0,movies:["Film Red","Stampede","Gold","Z","Strong World","Baron Omatsuri"]}}
  },
  spyFamily:{
    name:"Spy x Family", emoji:"🕵️", color:"#2a5a3a",
    desc:"Un espion, une tueuse et un télépathe forment une famille pour une mission de paix.",
    seasons:{
      1:{name:"Saison 1",episodes:25},
      2:{name:"Saison 2",episodes:12}
    }
  },
  oshiNoKo:{
    name:"Oshi No Ko", emoji:"⭐", color:"#8a4a6a",
    desc:"Un médecin réincarné en enfant d'une idole découvre les coulisses du show-business.",
    seasons:{
      1:{name:"Saison 1",episodes:11},
      2:{name:"Saison 2",episodes:13}
    }
  },
  blackClover:{
    name:"Black Clover", emoji:"📖", color:"#3a6a1a",
    desc:"Asta, un garçon sans magie, vise à devenir le Roi Sorcier.",
    seasons:{1:{name:"Série complète",episodes:170}}
  },
  mha:{
    name:"My Hero Academia", emoji:"💥", color:"#1a8a3a",
    desc:"Dans un monde de super-pouvoirs, Izuku Midoriya rêve de devenir un héros.",
    seasons:{
      1:{name:"Saison 1",episodes:13},
      2:{name:"Saison 2",episodes:25},
      3:{name:"Saison 3",episodes:25},
      4:{name:"Saison 4",episodes:25},
      5:{name:"Saison 5",episodes:25},
      6:{name:"Saison 6",episodes:25},
      7:{name:"Saison 7",episodes:21}
    }
  }
};
const ANIME_KEYS = Object.keys(animeCatalog);


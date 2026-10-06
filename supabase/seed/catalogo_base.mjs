// Gera supabase/seed/catalogo_base.sql a partir da lista abaixo.
// Preços: médias estimadas para o Rio de Janeiro (atacarejo/distribuidor, out/2026),
// marcadas como "estimativa inicial" — a função "Analisar preços" do admin é que valida/atualiza.
//   un: kg | g | L | ml | un | m2    qtd: quantidade típica do pacote    preco: R$ por esse pacote
//   aprov: % aproveitado (perda = 100 - aprov)    rend: rendimento no preparo (arroz cru → 3x pronto)
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const I = (nome, sinonimos, categoria, un, qtd, preco, extra = {}) => ({ nome, sinonimos, categoria, un, qtd, preco, aprov: 100, rend: 1, ...extra });

export const CATALOGO = [
  // ——— carnes bovinas ———
  I("Picanha", ["picanha bovina"], "carne_bovina", "kg", 1, 69.9, { aprov: 85 }),
  I("Contrafilé", ["contra filé", "contra-filé", "chorizo"], "carne_bovina", "kg", 1, 46.9, { aprov: 82 }),
  I("Alcatra", ["miolo de alcatra"], "carne_bovina", "kg", 1, 42.9, { aprov: 85 }),
  I("Filé mignon", ["file mignon", "mignon"], "carne_bovina", "kg", 1, 79.9, { aprov: 80 }),
  I("Patinho", ["patinho moído"], "carne_bovina", "kg", 1, 38.9, { aprov: 90 }),
  I("Acém", ["acem"], "carne_bovina", "kg", 1, 29.9, { aprov: 85 }),
  I("Músculo", ["musculo"], "carne_bovina", "kg", 1, 31.9, { aprov: 85 }),
  I("Coxão mole", ["coxao mole", "chã de dentro"], "carne_bovina", "kg", 1, 39.9, { aprov: 88 }),
  I("Coxão duro", ["coxao duro", "chã de fora"], "carne_bovina", "kg", 1, 35.9, { aprov: 88 }),
  I("Fraldinha", [], "carne_bovina", "kg", 1, 44.9, { aprov: 85 }),
  I("Maminha", [], "carne_bovina", "kg", 1, 45.9, { aprov: 88 }),
  I("Costela bovina", ["costela de boi", "costela"], "carne_bovina", "kg", 1, 32.9, { aprov: 60 }),
  I("Cupim", [], "carne_bovina", "kg", 1, 39.9, { aprov: 80 }),
  I("Carne moída", ["carne moida", "moída de primeira"], "carne_bovina", "kg", 1, 34.9, { aprov: 92 }),
  I("Blend de hambúrguer", ["blend", "carne de hambúrguer", "hamburguer bovino"], "carne_bovina", "kg", 1, 36.9, { aprov: 92 }),
  I("Carne seca", ["carne de sol", "jabá", "charque"], "carne_bovina", "kg", 1, 49.9, { aprov: 75 }),
  I("Bife ancho", ["ancho"], "carne_bovina", "kg", 1, 74.9, { aprov: 88 }),
  I("Lagarto", [], "carne_bovina", "kg", 1, 38.9, { aprov: 90 }),

  // ——— suínos e embutidos ———
  I("Lombo suíno", ["lombo de porco", "lombo"], "carne_suina", "kg", 1, 24.9, { aprov: 90 }),
  I("Pernil suíno", ["pernil"], "carne_suina", "kg", 1, 19.9, { aprov: 80 }),
  I("Costelinha suína", ["costela de porco", "costelinha"], "carne_suina", "kg", 1, 27.9, { aprov: 65 }),
  I("Barriga suína", ["pancetta", "barriga de porco"], "carne_suina", "kg", 1, 26.9, { aprov: 85 }),
  I("Bisteca suína", ["bisteca"], "carne_suina", "kg", 1, 21.9, { aprov: 85 }),
  I("Bacon", ["bacon em cubos", "bacon fatiado"], "carne_suina", "kg", 1, 34.9, { aprov: 75 }),
  I("Linguiça toscana", ["linguica toscana", "linguiça de porco"], "carne_suina", "kg", 1, 22.9, { aprov: 85 }),
  I("Linguiça calabresa", ["calabresa", "linguica calabresa"], "carne_suina", "kg", 1, 26.9, { aprov: 90 }),
  I("Presunto", ["presunto cozido", "presunto fatiado"], "carne_suina", "kg", 1, 29.9),
  I("Salame", ["salame italiano"], "carne_suina", "kg", 1, 59.9),
  I("Pepperoni", [], "carne_suina", "kg", 1, 54.9),
  I("Salsicha", ["salsicha hot dog"], "carne_suina", "kg", 1, 16.9),
  I("Mortadela", [], "carne_suina", "kg", 1, 19.9),
  I("Peito de peru", ["blanquet de peru", "peru fatiado"], "aves", "kg", 1, 44.9),

  // ——— aves ———
  I("Peito de frango", ["filé de frango", "file de frango", "frango peito"], "aves", "kg", 1, 19.9, { aprov: 90 }),
  I("Coxa e sobrecoxa de frango", ["coxa de frango", "sobrecoxa", "coxa sobrecoxa"], "aves", "kg", 1, 13.9, { aprov: 70 }),
  I("Frango inteiro", ["frango", "frango congelado"], "aves", "kg", 1, 11.9, { aprov: 65 }),
  I("Asa de frango", ["asinha", "tulipa de frango", "asa"], "aves", "kg", 1, 16.9, { aprov: 75 }),
  I("Coração de frango", ["coracao de frango"], "aves", "kg", 1, 24.9, { aprov: 90 }),
  I("Coxinha da asa", ["drumete"], "aves", "kg", 1, 17.9, { aprov: 75 }),
  I("Frango desfiado cozido", ["frango desfiado"], "aves", "kg", 1, 32.9),

  // ——— peixes e frutos do mar ———
  I("Salmão fresco", ["salmao", "salmão", "filé de salmão"], "peixes_frutos_mar", "kg", 1, 79.9, { aprov: 70 }),
  I("Tilápia filé", ["tilapia", "filé de tilápia", "saint peter"], "peixes_frutos_mar", "kg", 1, 39.9, { aprov: 95 }),
  I("Camarão limpo", ["camarao", "camarão", "camarão descascado", "camarão cinza"], "peixes_frutos_mar", "kg", 1, 69.9, { aprov: 90 }),
  I("Camarão com casca", ["camarão inteiro", "camarão VG"], "peixes_frutos_mar", "kg", 1, 49.9, { aprov: 55 }),
  I("Bacalhau dessalgado", ["bacalhau", "lascas de bacalhau"], "peixes_frutos_mar", "kg", 1, 89.9, { aprov: 85 }),
  I("Lula limpa", ["lula", "anéis de lula"], "peixes_frutos_mar", "kg", 1, 44.9, { aprov: 85 }),
  I("Polvo", [], "peixes_frutos_mar", "kg", 1, 89.9, { aprov: 60 }),
  I("Atum fresco", ["atum", "lombo de atum"], "peixes_frutos_mar", "kg", 1, 84.9, { aprov: 85 }),
  I("Atum em lata", ["atum enlatado", "atum ralado"], "peixes_frutos_mar", "g", 170, 7.9),
  I("Sardinha fresca", ["sardinha"], "peixes_frutos_mar", "kg", 1, 16.9, { aprov: 60 }),
  I("Mexilhão", ["marisco", "mexilhao"], "peixes_frutos_mar", "kg", 1, 34.9, { aprov: 70 }),
  I("Kani", ["kani kama", "kanikama", "bastão de caranguejo"], "japonesa", "kg", 1, 36.9),
  I("Pescada branca filé", ["pescada", "filé de pescada", "merluza"], "peixes_frutos_mar", "kg", 1, 32.9, { aprov: 95 }),

  // ——— laticínios e ovos ———
  I("Queijo mussarela", ["mussarela", "muçarela", "mozzarella"], "laticinios", "kg", 1, 39.9),
  I("Queijo prato", ["prato fatiado"], "laticinios", "kg", 1, 42.9),
  I("Queijo parmesão", ["parmesao", "parmesão ralado", "grana"], "laticinios", "kg", 1, 69.9),
  I("Queijo coalho", ["coalho"], "laticinios", "kg", 1, 44.9),
  I("Queijo minas frescal", ["minas frescal", "queijo branco"], "laticinios", "kg", 1, 36.9),
  I("Queijo cheddar", ["cheddar", "cheddar fatiado"], "laticinios", "kg", 1, 49.9),
  I("Queijo gorgonzola", ["gorgonzola"], "laticinios", "kg", 1, 79.9),
  I("Queijo provolone", ["provolone"], "laticinios", "kg", 1, 59.9),
  I("Queijo cream cheese", ["cream cheese", "cremoso"], "laticinios", "kg", 1, 39.9),
  I("Requeijão", ["requeijao", "requeijão cremoso"], "laticinios", "kg", 1, 29.9),
  I("Catupiry", ["catupiry original"], "laticinios", "kg", 1, 39.9),
  I("Manteiga", ["manteiga com sal", "manteiga sem sal"], "laticinios", "kg", 1, 49.9),
  I("Margarina", [], "laticinios", "kg", 1, 12.9),
  I("Creme de leite", ["creme de leite fresco"], "laticinios", "L", 1, 15.9),
  I("Creme de leite caixinha", ["creme de leite UHT"], "laticinios", "g", 200, 3.4),
  I("Leite integral", ["leite", "leite UHT"], "laticinios", "L", 1, 5.2),
  I("Leite condensado", [], "laticinios", "g", 395, 6.9),
  I("Iogurte natural", ["iogurte"], "laticinios", "g", 170, 3.2),
  I("Leite em pó", ["leite po"], "laticinios", "g", 400, 17.9),
  I("Ovo", ["ovos", "ovo branco", "dúzia de ovos"], "ovos", "un", 30, 19.9, { aprov: 88 }),
  I("Ovo de codorna", ["codorna"], "ovos", "un", 30, 12.9, { aprov: 85 }),

  // ——— hortifruti ———
  I("Batata inglesa", ["batata", "batata lavada"], "hortifruti", "kg", 1, 5.9, { aprov: 80 }),
  I("Batata doce", ["batata-doce"], "hortifruti", "kg", 1, 5.9, { aprov: 85 }),
  I("Batata palito congelada", ["batata frita congelada", "batata pré-frita", "batata congelada"], "hortifruti", "kg", 1, 14.9),
  I("Mandioca", ["aipim", "macaxeira"], "hortifruti", "kg", 1, 5.9, { aprov: 70 }),
  I("Cebola", ["cebola branca"], "hortifruti", "kg", 1, 5.4, { aprov: 85 }),
  I("Cebola roxa", [], "hortifruti", "kg", 1, 8.9, { aprov: 85 }),
  I("Alho", ["alho descascado", "dente de alho"], "hortifruti", "kg", 1, 29.9, { aprov: 85 }),
  I("Tomate", ["tomate italiano", "tomate salada"], "hortifruti", "kg", 1, 7.9, { aprov: 90 }),
  I("Tomate cereja", ["tomate grape", "tomatinho"], "hortifruti", "kg", 1, 16.9, { aprov: 95 }),
  I("Alface americana", ["alface", "alface crespa"], "hortifruti", "un", 1, 3.9, { aprov: 80 }),
  I("Rúcula", ["rucula"], "hortifruti", "un", 1, 3.5, { aprov: 85 }),
  I("Cenoura", [], "hortifruti", "kg", 1, 5.9, { aprov: 85 }),
  I("Abobrinha", [], "hortifruti", "kg", 1, 6.9, { aprov: 90 }),
  I("Berinjela", [], "hortifruti", "kg", 1, 7.9, { aprov: 90 }),
  I("Pimentão verde", ["pimentão", "pimentao"], "hortifruti", "kg", 1, 8.9, { aprov: 82 }),
  I("Pimentão vermelho", [], "hortifruti", "kg", 1, 14.9, { aprov: 82 }),
  I("Brócolis", ["brocolis", "brócolis ninja"], "hortifruti", "un", 1, 7.9, { aprov: 70 }),
  I("Couve-flor", ["couve flor"], "hortifruti", "un", 1, 8.9, { aprov: 70 }),
  I("Couve", ["couve manteiga"], "hortifruti", "un", 1, 3.5, { aprov: 80 }),
  I("Repolho", ["repolho verde"], "hortifruti", "kg", 1, 4.9, { aprov: 85 }),
  I("Espinafre", [], "hortifruti", "un", 1, 4.5, { aprov: 80 }),
  I("Abóbora cabotiá", ["abóbora", "abobora", "cabotiá", "jerimum"], "hortifruti", "kg", 1, 5.9, { aprov: 75 }),
  I("Chuchu", [], "hortifruti", "kg", 1, 4.9, { aprov: 80 }),
  I("Pepino", ["pepino japonês"], "hortifruti", "kg", 1, 6.9, { aprov: 90 }),
  I("Beterraba", [], "hortifruti", "kg", 1, 5.9, { aprov: 80 }),
  I("Milho verde", ["milho", "espiga de milho"], "hortifruti", "un", 1, 2.5, { aprov: 55 }),
  I("Milho em conserva", ["milho enlatado", "milho lata"], "molhos_conservas", "g", 170, 3.9),
  I("Cogumelo paris", ["champignon fresco", "cogumelo"], "hortifruti", "kg", 1, 32.9, { aprov: 95 }),
  I("Champignon em conserva", ["champignon", "cogumelo em conserva"], "molhos_conservas", "g", 200, 7.9),
  I("Limão taiti", ["limão", "limao"], "hortifruti", "kg", 1, 6.9, { aprov: 45 }),
  I("Limão siciliano", [], "hortifruti", "kg", 1, 12.9, { aprov: 45 }),
  I("Laranja", ["laranja pera"], "hortifruti", "kg", 1, 4.9, { aprov: 50 }),
  I("Banana prata", ["banana"], "hortifruti", "kg", 1, 6.9, { aprov: 65 }),
  I("Maçã", ["maca", "maçã fuji"], "hortifruti", "kg", 1, 9.9, { aprov: 85 }),
  I("Abacaxi", [], "hortifruti", "un", 1, 7.9, { aprov: 55 }),
  I("Manga", ["manga palmer", "manga tommy"], "hortifruti", "kg", 1, 7.9, { aprov: 65 }),
  I("Morango", [], "hortifruti", "kg", 1, 24.9, { aprov: 90 }),
  I("Melancia", [], "hortifruti", "kg", 1, 3.9, { aprov: 55 }),
  I("Mamão papaya", ["mamão", "mamao"], "hortifruti", "kg", 1, 6.9, { aprov: 65 }),
  I("Abacate", [], "hortifruti", "kg", 1, 8.9, { aprov: 70 }),
  I("Maracujá", ["maracuja"], "hortifruti", "kg", 1, 12.9, { aprov: 40 }),
  I("Coco ralado", ["coco seco ralado"], "doces_confeitaria", "g", 100, 4.9),
  I("Salsinha", ["salsa", "cheiro verde"], "hortifruti", "un", 1, 2.5, { aprov: 70 }),
  I("Cebolinha", [], "hortifruti", "un", 1, 2.5, { aprov: 75 }),
  I("Coentro", [], "hortifruti", "un", 1, 2.5, { aprov: 70 }),
  I("Manjericão", ["manjericao", "basílico"], "hortifruti", "un", 1, 3.9, { aprov: 70 }),
  I("Hortelã", ["hortela"], "hortifruti", "un", 1, 3.0, { aprov: 70 }),
  I("Gengibre", [], "hortifruti", "kg", 1, 19.9, { aprov: 80 }),
  I("Pimenta dedo-de-moça", ["pimenta dedo de moça", "pimenta vermelha"], "hortifruti", "kg", 1, 24.9, { aprov: 85 }),
  I("Ervilha congelada", ["ervilha"], "hortifruti", "kg", 1, 12.9),
  I("Mix de legumes congelado", ["legumes congelados", "jardineira"], "hortifruti", "kg", 1, 11.9),

  // ——— grãos, cereais e secos ———
  I("Arroz branco", ["arroz", "arroz agulhinha", "arroz tipo 1"], "graos_cereais", "kg", 5, 24.9, { rend: 3 }),
  I("Arroz integral", [], "graos_cereais", "kg", 1, 7.9, { rend: 2.8 }),
  I("Arroz arbóreo", ["arroz arboreo", "arroz para risoto"], "graos_cereais", "kg", 1, 16.9, { rend: 3 }),
  I("Arroz japonês", ["arroz para sushi", "shari", "arroz japones"], "japonesa", "kg", 5, 44.9, { rend: 2.5 }),
  I("Feijão preto", ["feijao preto", "feijão"], "graos_cereais", "kg", 1, 8.9, { rend: 2.5 }),
  I("Feijão carioca", ["feijao carioca"], "graos_cereais", "kg", 1, 8.4, { rend: 2.5 }),
  I("Grão-de-bico", ["grão de bico", "grao de bico"], "graos_cereais", "kg", 1, 14.9, { rend: 2.3 }),
  I("Lentilha", [], "graos_cereais", "kg", 1, 11.9, { rend: 2.3 }),
  I("Quinoa", [], "graos_cereais", "kg", 1, 39.9, { rend: 3 }),
  I("Aveia em flocos", ["aveia"], "graos_cereais", "kg", 1, 11.9),
  I("Farinha de trigo", ["farinha", "trigo"], "massas_farinhas", "kg", 1, 4.9),
  I("Farinha de trigo 00", ["farinha 00", "farinha para pizza"], "massas_farinhas", "kg", 1, 8.9),
  I("Farinha de mandioca", ["farinha de mandioca torrada"], "massas_farinhas", "kg", 1, 7.9),
  I("Farinha de rosca", ["farinha de rosca", "panko"], "massas_farinhas", "kg", 1, 9.9),
  I("Amido de milho", ["maisena", "maizena"], "massas_farinhas", "kg", 1, 9.9),
  I("Fubá", ["fuba", "farinha de milho"], "massas_farinhas", "kg", 1, 5.9),
  I("Polvilho azedo", ["polvilho"], "massas_farinhas", "kg", 1, 9.9),
  I("Macarrão espaguete", ["espaguete", "macarrão", "macarrao", "spaghetti"], "massas_farinhas", "kg", 1, 7.9, { rend: 2.3 }),
  I("Macarrão penne", ["penne"], "massas_farinhas", "kg", 1, 7.9, { rend: 2.3 }),
  I("Massa de lasanha", ["lasanha pré-cozida", "massa para lasanha"], "massas_farinhas", "kg", 1, 14.9, { rend: 1.8 }),
  I("Macarrão para yakisoba", ["macarrão yakisoba", "lámen", "lamen"], "chinesa", "kg", 1, 12.9, { rend: 1.5 }),
  I("Massa de pastel", ["disco de pastel", "massa pastel"], "massas_farinhas", "kg", 1, 16.9),
  I("Massa folhada", [], "massas_farinhas", "kg", 1, 24.9),
  I("Massa de pizza pré-assada", ["disco de pizza", "massa de pizza"], "massas_farinhas", "un", 1, 6.9),
  I("Pão de forma", ["pao de forma"], "paes_padaria", "un", 1, 8.9),
  I("Pão francês", ["pao frances", "pão de sal"], "paes_padaria", "kg", 1, 16.9),
  I("Pão de hambúrguer", ["pão brioche", "pao de hamburguer", "pão de burger"], "paes_padaria", "un", 1, 1.4),
  I("Pão de hot dog", ["pão de cachorro quente"], "paes_padaria", "un", 1, 0.9),
  I("Pão sírio", ["pao sirio", "pita"], "arabe", "un", 1, 1.5),
  I("Tortilha de trigo", ["tortilla", "wrap", "rap10"], "mexicana", "un", 1, 1.3),
  I("Fermento biológico seco", ["fermento", "fermento de pão"], "massas_farinhas", "g", 500, 29.9),
  I("Fermento químico", ["fermento em pó", "pó royal"], "doces_confeitaria", "g", 250, 8.9),
  I("Açúcar refinado", ["açúcar", "acucar", "açúcar branco"], "doces_confeitaria", "kg", 1, 4.4),
  I("Açúcar cristal", ["acucar cristal"], "doces_confeitaria", "kg", 1, 4.0),
  I("Açúcar demerara", ["demerara"], "doces_confeitaria", "kg", 1, 8.9),
  I("Sal refinado", ["sal", "sal de cozinha"], "temperos_condimentos", "kg", 1, 2.5),
  I("Sal grosso", [], "temperos_condimentos", "kg", 1, 2.9),

  // ——— óleos e gorduras ———
  I("Óleo de soja", ["óleo", "oleo", "óleo de cozinha"], "oleos_gorduras", "ml", 900, 7.9),
  I("Azeite de oliva extra virgem", ["azeite", "azeite extravirgem"], "oleos_gorduras", "ml", 500, 34.9),
  I("Óleo de girassol", [], "oleos_gorduras", "ml", 900, 9.9),
  I("Gordura vegetal para fritura", ["gordura hidrogenada", "gordura de fritura"], "oleos_gorduras", "kg", 1, 12.9),
  I("Banha de porco", ["banha"], "oleos_gorduras", "kg", 1, 14.9),
  I("Óleo de gergelim", ["oleo de gergelim"], "japonesa", "ml", 200, 19.9),

  // ——— temperos e condimentos ———
  I("Pimenta-do-reino moída", ["pimenta do reino", "pimenta preta"], "temperos_condimentos", "g", 500, 34.9),
  I("Páprica defumada", ["paprica", "páprica"], "temperos_condimentos", "g", 500, 29.9),
  I("Orégano", ["oregano"], "temperos_condimentos", "g", 500, 24.9),
  I("Cominho", [], "temperos_condimentos", "g", 500, 24.9),
  I("Colorau", ["colorífico", "urucum"], "temperos_condimentos", "g", 500, 9.9),
  I("Louro", ["folha de louro"], "temperos_condimentos", "g", 100, 9.9),
  I("Canela em pó", ["canela"], "doces_confeitaria", "g", 500, 34.9),
  I("Curry", [], "temperos_condimentos", "g", 500, 29.9),
  I("Chimichurri", [], "temperos_condimentos", "g", 500, 24.9),
  I("Tempero pronto", ["tempero completo", "sazón", "caldo em pó"], "temperos_condimentos", "kg", 1, 12.9),
  I("Caldo de carne em tablete", ["caldo knorr", "tablete de caldo"], "temperos_condimentos", "un", 1, 0.5),
  I("Vinagre de álcool", ["vinagre"], "temperos_condimentos", "ml", 750, 3.9),
  I("Vinagre balsâmico", ["balsamico"], "temperos_condimentos", "ml", 500, 19.9),
  I("Mostarda", [], "molhos_conservas", "kg", 1, 14.9),
  I("Ketchup", ["catchup"], "molhos_conservas", "kg", 1, 13.9),
  I("Maionese", [], "molhos_conservas", "kg", 1, 15.9),
  I("Molho de tomate", ["molho de tomate pronto", "polpa de tomate", "passata"], "molhos_conservas", "kg", 1, 8.9),
  I("Extrato de tomate", [], "molhos_conservas", "g", 340, 4.9),
  I("Molho shoyu", ["shoyu", "molho de soja"], "japonesa", "ml", 900, 9.9),
  I("Molho inglês", ["molho ingles", "worcestershire"], "molhos_conservas", "ml", 150, 4.9),
  I("Molho barbecue", ["barbecue", "bbq"], "molhos_conservas", "kg", 1, 24.9),
  I("Molho de pimenta", ["tabasco", "pimenta líquida"], "molhos_conservas", "ml", 150, 6.9),
  I("Azeitona verde", ["azeitona", "azeitona sem caroço"], "molhos_conservas", "kg", 1, 24.9),
  I("Azeitona preta", [], "molhos_conservas", "kg", 1, 29.9),
  I("Palmito em conserva", ["palmito"], "molhos_conservas", "g", 300, 14.9),
  I("Pepino em conserva", ["picles", "pickles"], "molhos_conservas", "g", 300, 9.9),
  I("Tahine", ["tahini", "pasta de gergelim"], "arabe", "g", 500, 29.9),
  I("Grão-de-bico cozido (homus base)", ["homus", "hummus"], "arabe", "kg", 1, 19.9),
  I("Feijão preto refogado (base mexicana)", ["refried beans", "feijão refogado"], "mexicana", "kg", 1, 16.9),
  I("Jalapeño em conserva", ["jalapeno", "pimenta jalapeño"], "mexicana", "g", 300, 12.9),
  I("Guacamole base (abacate)", ["guacamole"], "mexicana", "kg", 1, 29.9),
  I("Molho teriyaki", ["teriyaki", "tarê", "tare"], "japonesa", "ml", 500, 16.9),
  I("Molho agridoce", ["agridoce"], "chinesa", "ml", 500, 12.9),
  I("Óleo de pimenta / chili oil", ["chili oil", "óleo de pimenta"], "chinesa", "ml", 200, 14.9),

  // ——— japonesa ———
  I("Alga nori", ["nori", "folha de alga"], "japonesa", "un", 50, 39.9),
  I("Gergelim", ["gergelim branco", "gergelim torrado"], "japonesa", "kg", 1, 24.9),
  I("Vinagre de arroz", ["su", "tempero para sushi"], "japonesa", "ml", 500, 14.9),
  I("Wasabi em pasta", ["wasabi"], "japonesa", "g", 43, 9.9),
  I("Gengibre em conserva", ["gari", "gengibre para sushi"], "japonesa", "kg", 1, 29.9),
  I("Hashi descartável", ["hashi"], "descartaveis", "un", 100, 24.9),
  I("Missô", ["misso", "pasta de soja"], "japonesa", "kg", 1, 34.9),
  I("Hondashi", ["dashi", "caldo de peixe"], "japonesa", "g", 100, 14.9),

  // ——— doces e confeitaria ———
  I("Chocolate ao leite em barra", ["chocolate", "chocolate ao leite"], "doces_confeitaria", "kg", 1, 44.9),
  I("Chocolate meio amargo", ["chocolate 50%", "meio amargo"], "doces_confeitaria", "kg", 1, 49.9),
  I("Chocolate em pó", ["cacau em pó", "achocolatado"], "doces_confeitaria", "kg", 1, 24.9),
  I("Granulado de chocolate", ["granulado"], "doces_confeitaria", "kg", 1, 19.9),
  I("Doce de leite", [], "doces_confeitaria", "kg", 1, 19.9),
  I("Goiabada", [], "doces_confeitaria", "kg", 1, 12.9),
  I("Mel", [], "doces_confeitaria", "kg", 1, 39.9),
  I("Gelatina em pó", ["gelatina"], "doces_confeitaria", "g", 85, 2.9),
  I("Chantilly", ["chantili", "creme para chantilly"], "doces_confeitaria", "L", 1, 19.9),
  I("Sorvete de creme", ["sorvete"], "doces_confeitaria", "L", 5, 59.9),
  I("Polpa de açaí", ["açaí", "acai", "açaí congelado"], "doces_confeitaria", "kg", 1, 24.9),
  I("Polpa de fruta congelada", ["polpa de fruta", "polpa"], "bebidas", "g", 100, 1.6),
  I("Leite de coco", [], "doces_confeitaria", "ml", 200, 3.9),
  I("Paçoca", ["pacoca"], "doces_confeitaria", "un", 1, 0.6),
  I("Nutella / creme de avelã", ["nutella", "creme de avelã"], "doces_confeitaria", "g", 650, 34.9),

  // ——— bebidas ———
  I("Refrigerante lata", ["coca lata", "refrigerante 350ml", "coca-cola lata"], "bebidas", "un", 12, 42.9),
  I("Refrigerante 2L", ["coca 2l", "refrigerante 2 litros"], "bebidas", "un", 1, 9.9),
  I("Água mineral 500ml", ["água", "agua mineral", "água sem gás"], "bebidas", "un", 12, 14.9),
  I("Água com gás 500ml", ["água com gás"], "bebidas", "un", 12, 19.9),
  I("Cerveja long neck", ["long neck", "heineken long neck", "cerveja 330ml"], "bebidas", "un", 24, 119.9),
  I("Cerveja lata 350ml", ["cerveja lata", "brahma lata"], "bebidas", "un", 12, 42.9),
  I("Chope (barril 30L)", ["chope", "chopp", "barril de chope"], "bebidas", "L", 30, 349.0),
  I("Suco de laranja natural (laranja)", ["suco de laranja"], "bebidas", "L", 1, 8.9),
  I("Suco de caixinha 1L", ["suco de caixa", "suco pronto"], "bebidas", "L", 1, 6.9),
  I("Energético 250ml", ["red bull", "energético"], "bebidas", "un", 1, 7.9),
  I("Café em grãos", ["café", "cafe", "café torrado"], "bebidas", "kg", 1, 49.9),
  I("Café em pó", ["café moído", "pó de café"], "bebidas", "kg", 1, 32.9),
  I("Cachaça", ["cachaca", "pinga"], "bebidas", "ml", 1000, 29.9),
  I("Vodka", [], "bebidas", "ml", 1000, 49.9),
  I("Gin", [], "bebidas", "ml", 750, 89.9),
  I("Whisky 8 anos", ["whisky", "uísque", "red label"], "bebidas", "ml", 1000, 119.9),
  I("Vinho tinto de mesa", ["vinho", "vinho tinto"], "bebidas", "ml", 750, 34.9),
  I("Água tônica", ["tônica", "tonica"], "bebidas", "un", 6, 19.9),
  I("Gelo em cubos", ["gelo", "saco de gelo"], "bebidas", "kg", 5, 14.9),
  I("Caldo de cana (cana)", ["cana de açúcar", "cana"], "bebidas", "kg", 1, 2.5, { aprov: 55 }),

  // ——— embalagens e descartáveis ———
  I("Marmitex alumínio nº 8", ["marmitex", "quentinha", "marmita de alumínio"], "embalagens", "un", 100, 79.9),
  I("Marmita isopor 750ml", ["marmita isopor", "embalagem isopor"], "embalagens", "un", 100, 69.9),
  I("Pote plástico 500ml com tampa", ["pote 500ml", "pote plástico"], "embalagens", "un", 100, 59.9),
  I("Caixa de pizza 35cm", ["caixa de pizza", "embalagem pizza"], "embalagens", "un", 50, 89.9),
  I("Embalagem de hambúrguer", ["caixa de hambúrguer", "box burger"], "embalagens", "un", 100, 54.9),
  I("Embalagem para batata frita", ["cone de batata", "saco de batata"], "embalagens", "un", 100, 39.9),
  I("Copo plástico 300ml", ["copo descartável", "copo 300ml"], "descartaveis", "un", 100, 12.9),
  I("Copo para açaí 500ml com tampa", ["copo açaí", "copo 500ml"], "embalagens", "un", 100, 69.9),
  I("Sacola plástica delivery", ["sacola", "sacola plástica"], "embalagens", "un", 100, 24.9),
  I("Saco de papel kraft", ["saco kraft", "sacola kraft"], "embalagens", "un", 100, 49.9),
  I("Talher descartável kit", ["kit talher", "talheres descartáveis"], "descartaveis", "un", 100, 39.9),
  I("Guardanapo", ["guardanapo de papel"], "descartaveis", "un", 1000, 24.9),
  I("Papel alumínio", [], "descartaveis", "m2", 15, 9.9),
  I("Filme plástico PVC", ["plástico filme", "filme pvc"], "descartaveis", "m2", 30, 12.9),
  I("Canudo", ["canudo de papel"], "descartaveis", "un", 200, 14.9),
  I("Lacre de segurança para delivery", ["lacre", "etiqueta lacre"], "embalagens", "un", 500, 34.9),
  I("Embalagem de sushi (bandeja)", ["bandeja de sushi", "embalagem sushi"], "embalagens", "un", 50, 69.9),
  I("Embalagem para pastel", ["saco de pastel"], "embalagens", "un", 500, 29.9),
];

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const arr = (a) => "array[" + (a.length ? a.map(q).join(",") : "") + "]::text[]";

export function gerarSql() {
  const linhas = CATALOGO.map((i) =>
    `  (${q(i.nome)}, ${arr(i.sinonimos)}, ${q(i.categoria)}, ${q(i.un)}, ${i.qtd}, ${i.preco}, ${i.aprov}, ${i.rend})`
  );
  return `-- Gerado por catalogo_base.mjs — ${CATALOGO.length} insumos · Rio de Janeiro · preços estimados (out/2026)
insert into public.catalogo_base (nome, sinonimos, categoria, unidade_compra, qtd_padrao, preco_medio, fator_aproveitamento, rendimento_preparo, regiao, origem_preco)
select v.nome, v.sinonimos, v.categoria, v.unidade_compra, v.qtd_padrao, v.preco_medio, v.fator_aproveitamento, v.rendimento_preparo, 'Rio de Janeiro', 'estimativa inicial'
from (values
${linhas.join(",\n")}
) as v(nome, sinonimos, categoria, unidade_compra, qtd_padrao, preco_medio, fator_aproveitamento, rendimento_preparo)
on conflict (lower(nome), regiao) do nothing;

insert into public.catalogo_precos_historico (catalogo_id, preco, origem)
select c.id, c.preco_medio, 'estimativa inicial' from public.catalogo_base c
where not exists (select 1 from public.catalogo_precos_historico h where h.catalogo_id = c.id);
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = join(dirname(fileURLToPath(import.meta.url)), "catalogo_base.sql");
  writeFileSync(out, gerarSql());
  const nomes = new Set();
  for (const i of CATALOGO) { const k = i.nome.toLowerCase(); if (nomes.has(k)) throw new Error("nome duplicado: " + i.nome); nomes.add(k); }
  console.log(`ok: ${CATALOGO.length} insumos → ${out}`);
}

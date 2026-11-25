/* =========================================================
   FLIPERAMA DA MATEMÁTICA — ranking comum

   O ranking fica guardado SÓ neste navegador, neste computador
   (no "localStorage" do navegador). Nada vai para a internet e
   ninguém de fora vê. Cada computador tem o seu próprio ranking.

   Como funciona:
   - O aluno entra no ranking só se quiser, digitando um nome ou apelido.
   - Cada jogo tem um ranking para cada nível (Fácil, Médio, Difícil).
   - Se o mesmo nome jogar de novo, fica guardado só o recorde dele
     (mais pontos; se empatar, o menor tempo).
   - O pódio da página inicial usa o nível Difícil: é a MÉDIA dos
     recordes de cada aluno nos jogos que ele jogou.
   ========================================================= */

const Ranking = (() => {
  const CHAVE = "fliperama-ranking";
  const TAMANHO_MAXIMO_NICK = 20;

  // Palavras que não podem aparecer no nome (palavrões e ofensas comuns)
  const PROIBIDAS = [
    "porra", "caralho", "merda", "puta", "puto", "buceta", "cu", "foda", "fodase",
    "fdp", "vsf", "pqp", "tnc", "viado", "bosta", "cacete", "arrombado", "arrombada",
    "otario", "otaria", "idiota", "burro", "burra", "imbecil", "retardado", "retardada",
    "lixo", "corno", "piranha", "vagabundo", "vagabunda", "babaca", "trouxa",
  ];

  // ----- Ler e gravar no navegador -----

  function ler() {
    try {
      const dados = JSON.parse(localStorage.getItem(CHAVE));
      return dados && dados.jogos ? dados : { jogos: {} };
    } catch (erro) {
      return { jogos: {} };
    }
  }

  function gravar(dados) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(dados));
      return true;
    } catch (erro) {
      return false; // navegador sem espaço ou bloqueado
    }
  }

  // "Ána  Clara" e "ana clara" viram a mesma chave: "ana clara"
  function chaveDoNick(nick) {
    return nick
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  // ----- Conferir o nome digitado -----

  function validarNick(texto) {
    const nick = String(texto || "").replace(/\s+/g, " ").trim();
    if (!nick) {
      return { ok: false, erro: "Digite um nome ou apelido." };
    }
    if (nick.length > TAMANHO_MAXIMO_NICK) {
      return { ok: false, erro: `Use no máximo ${TAMANHO_MAXIMO_NICK} letras.` };
    }
    if (!/^[\p{L}\p{N} ._-]+$/u.test(nick)) {
      return { ok: false, erro: "Use só letras, números e espaço." };
    }
    const palavras = chaveDoNick(nick).split(/[ ._-]+/);
    if (palavras.some((p) => PROIBIDAS.includes(p))) {
      return { ok: false, erro: "Esse nome não pode. Escolha outro, sem palavrão nem ofensa." };
    }
    return { ok: true, nick };
  }

  // a é melhor que b? (mais pontos; se empatar, menos tempo)
  function ehMelhor(a, b) {
    return a.pontos > b.pontos || (a.pontos === b.pontos && a.tempo < b.tempo);
  }

  function ordenar(lista) {
    return lista.sort((a, b) => b.pontos - a.pontos || a.tempo - b.tempo);
  }

  // ----- Salvar o resultado de uma partida -----
  // Devolve se foi recorde e qual é o recorde atual do aluno.
  function salvar({ jogo, nomeDoJogo, nivel, nick, pontos, tempo }) {
    const dados = ler();
    if (!dados.jogos[jogo]) dados.jogos[jogo] = { nome: nomeDoJogo, niveis: {} };
    dados.jogos[jogo].nome = nomeDoJogo;
    const niveis = dados.jogos[jogo].niveis;
    if (!niveis[nivel]) niveis[nivel] = {};

    const chave = chaveDoNick(nick);
    const anterior = niveis[nivel][chave];
    const novo = { nick, pontos, tempo };
    const recorde = !anterior || ehMelhor(novo, anterior);
    if (recorde) niveis[nivel][chave] = novo;
    else niveis[nivel][chave].nick = nick; // guarda o jeito mais novo de escrever o nome

    return { gravou: gravar(dados), recorde, anterior, atual: niveis[nivel][chave] };
  }

  // ----- Os 10 melhores de um jogo, em um nível -----
  function top(jogo, nivel, quantos = 10) {
    const jogoSalvo = ler().jogos[jogo];
    const registros = jogoSalvo && jogoSalvo.niveis[nivel] ? Object.values(jogoSalvo.niveis[nivel]) : [];
    return ordenar(registros).slice(0, quantos);
  }

  // ----- Pódio geral: média dos recordes no nível Difícil -----
  function podio(nivel = "dificil", quantos = 10) {
    const porAluno = {};
    for (const jogo of Object.values(ler().jogos)) {
      const registros = jogo.niveis[nivel] || {};
      for (const [chave, r] of Object.entries(registros)) {
        if (!porAluno[chave]) porAluno[chave] = { nick: r.nick, recordes: [], tempo: 0 };
        porAluno[chave].recordes.push(r.pontos);
        porAluno[chave].tempo += r.tempo;
      }
    }
    return Object.values(porAluno)
      .map((a) => ({
        nick: a.nick,
        media: Math.round(a.recordes.reduce((soma, p) => soma + p, 0) / a.recordes.length),
        jogos: a.recordes.length,
        tempo: a.tempo,
      }))
      // Maior média; se empatar, quem jogou mais jogos; depois, menor tempo
      .sort((a, b) => b.media - a.media || b.jogos - a.jogos || a.tempo - b.tempo)
      .slice(0, quantos);
  }

  function apagarTudo() {
    try {
      localStorage.removeItem(CHAVE);
    } catch (erro) {
      /* nada a fazer */
    }
  }

  function formatarTempo(segundos) {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return min + ":" + String(seg).padStart(2, "0");
  }

  // ----- Desenhar a tabela do ranking dentro de um elemento -----
  // (usa textContent: o nome digitado nunca vira código na página)
  function desenharTabela(elemento, jogo, nivel, nickEmDestaque) {
    const lista = top(jogo, nivel);
    elemento.innerHTML = "";

    if (lista.length === 0) {
      const vazio = document.createElement("p");
      vazio.className = "ranking__vazio";
      vazio.textContent = "Ninguém no ranking deste nível ainda. Seja o primeiro!";
      elemento.appendChild(vazio);
      return;
    }

    const tabela = document.createElement("table");
    tabela.className = "ranking";
    const cabecalho = tabela.createTHead().insertRow();
    ["#", "Nome", "Pontos", "Tempo"].forEach((titulo) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = titulo;
      cabecalho.appendChild(th);
    });

    const corpo = tabela.createTBody();
    const destaque = nickEmDestaque ? chaveDoNick(nickEmDestaque) : null;
    lista.forEach((r, i) => {
      const linha = corpo.insertRow();
      if (destaque && chaveDoNick(r.nick) === destaque) linha.className = "ranking__voce";
      [i + 1 + "º", r.nick, r.pontos, formatarTempo(r.tempo)].forEach((valor) => {
        linha.insertCell().textContent = valor;
      });
    });
    elemento.appendChild(tabela);
  }

  return { validarNick, salvar, top, podio, apagarTudo, formatarTempo, desenharTabela };
})();

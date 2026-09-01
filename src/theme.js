export const C = {
  paper: "#F5F5F2",      // fundo
  paperAlt: "#FFFFFF",   // superfície
  ink: "#18181A",        // texto principal — contraste alto
  ink70: "#52525B",      // secundário legível
  ink45: "#78787F",      // rótulos
  rule: "#E2E2DE",
  ruleSoft: "#EDEDE9",
  red: "#C0362C",        // ruim
  redSoft: "#FBEAE7",
  ok: "#0E7A45",         // saudável
  okSoft: "#E6F3EC",
  warn: "#B45309",
  warnSoft: "#FDF3E3",
};

export const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&display=swap');
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  ::-webkit-scrollbar { width: 0; }
  body { background: ${C.paper}; }
  .mono { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; font-weight: 700; }
  .serif { font-weight: 800; letter-spacing: -0.02em; }
  .btn { cursor: pointer; font-family: inherit; }
  .btn:active { opacity: .75; }
  input, select { font-family: inherit; color: ${C.ink}; font-weight: 600; }
  input:focus, select:focus { outline: none; border-color: ${C.ink} !important; }
  input::placeholder { color: #A5A5AC; font-weight: 500; }

  /* rótulos legíveis: sem caixa-alta minúscula */
  .lbl { font-size: 12.5px; color: ${C.ink45}; font-weight: 600; letter-spacing: 0; text-transform: none; }
  .sec { font-size: 16px; font-weight: 700; color: ${C.ink}; margin: 30px 0 12px; }
  .sec:first-child { margin-top: 0; }
  .card { background: ${C.paperAlt}; border: 1px solid ${C.rule}; border-radius: 12px; }
  .row { border-bottom: 1px solid ${C.ruleSoft}; }
  .tap { cursor: pointer; }
  .tap:hover { background: #FAFAF8; }
  .fld { border: 1.5px solid ${C.rule}; background: #fff; border-radius: 8px; display: flex; align-items: center; padding: 0 10px; }
  .inp { border: none; background: transparent; outline: none; padding: 12px 3px; font-size: 16px; width: 100%; min-width: 0; font-weight: 600; }
  .numi { font-variant-numeric: tabular-nums; text-align: right; font-weight: 700; }
  .tag { font-size: 12px; font-weight: 700; border-radius: 6px; padding: 3px 8px; display: inline-block; }

  .shell { max-width: 560px; margin: 0 auto; padding: 22px 16px 100px; }
  .nav-side { display: none; }
  .nav-item { display:block; width:100%; background:none; border:none; border-radius: 8px;
    padding:12px 14px; font-family:inherit; font-size:15px; font-weight:600; color:${C.ink45};
    cursor:pointer; text-align:left; }
  .nav-item:hover { background:#EFEFEC; color:${C.ink}; }
  .nav-item.on { background:${C.ink}; color:#fff; }

  @media (min-width: 940px) {
    .nav-bottom { display: none !important; }
    .brand-mobile { display: none; }
    .app-wrap { padding-left: 244px; }
    .shell { max-width: 700px; padding: 36px 30px 64px; }
    .nav-side { display:flex; flex-direction:column; position:fixed; left:0; top:0; bottom:0;
      width:244px; padding:28px 16px; background:${C.paperAlt}; border-right:1px solid ${C.rule}; }
  }
`;

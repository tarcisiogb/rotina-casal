// ===================== UTILITÁRIOS GLOBAIS (topo, antes de tudo) =====================
function pad2(n) { n = Number(n); return n < 10 ? '0' + n : '' + n; }

function fmtDate(iso) {
  if (!iso) return '—';
  var p = iso.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}
function fmtDateShort(iso) {
  if (!iso) return '—';
  var p = iso.split('-');
  return p[2] + '/' + p[1];
}
function fmtMes(iso) {
  var meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  var p = iso.split('-');
  return meses[Number(p[1]) - 1] + '/' + p[0];
}
function hojeISO() {
  var d = new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function agoraHora() {
  var d = new Date();
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function diffDias(iso1, iso2) {
  var d1 = new Date(iso1 + 'T00:00:00');
  var d2 = new Date(iso2 + 'T00:00:00');
  return Math.round((d2 - d1) / 86400000);
}
function horaParaMin(hhmm) {
  if (!hhmm) return null;
  var p = hhmm.split(':');
  return Number(p[0]) * 60 + Number(p[1]);
}
function calcDuracaoSono(dormir, acordar) {
  var a = horaParaMin(dormir);
  var b = horaParaMin(acordar);
  if (a === null || b === null) return null;
  var dur = b - a;
  if (dur <= 0) dur += 24 * 60;
  return dur;
}
function calcSonoReal(dormir, acordar, intervalo) {
  var bruto = calcDuracaoSono(dormir, acordar);
  if (bruto === null) return null;
  var i = Number(intervalo) || 0;
  var real = bruto - i;
  return real < 0 ? 0 : real;
}
function calcDuracaoAtividade(inicio, fim) {
  var a = horaParaMin(inicio);
  var b = horaParaMin(fim);
  if (a === null || b === null) return null;
  var dur = b - a;
  if (dur < 0) dur += 24 * 60;
  return dur;
}
function minParaHoras(min) {
  if (min === null || min === undefined) return '—';
  var totalMin = Math.round(min);
  var h = Math.floor(totalMin / 60);
  var m = totalMin % 60;
  return h + 'h' + pad2(m);
}
function media(arr) {
  if (!arr || arr.length === 0) return null;
  var soma = 0;
  for (var i = 0; i < arr.length; i++) soma += arr[i];
  return soma / arr.length;
}
function fmt1(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Math.round(n * 10) / 10;
}
function uid() { return Date.now() + Math.floor(Math.random() * 1000); }

// Fase do ciclo — calculada com base no registro mais recente de ciclo cuja data <= dataISO
function ciclosOrdenados(ciclos) {
  return ciclos.slice().sort(function (a, b) { return a.dataInicio < b.dataInicio ? -1 : 1; });
}

function addDias(iso, n) {
  var d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

// Duração média do ciclo com base nos intervalos entre inícios de menstruação já registrados
function estimarDuracaoMedia(ciclos) {
  var ord = ciclosOrdenados(ciclos);
  var ds = [];
  for (var i = 0; i < ord.length - 1; i++) {
    var d = diffDias(ord[i].dataInicio, ord[i + 1].dataInicio);
    if (d > 0 && d < 90) ds.push(d);
  }
  return ds.length ? Math.round(media(ds)) : 28;
}

// Duração média da menstruação com base nos ciclos que já têm data de término registrada
function estimarDuracaoMenstruacao(ciclos) {
  var ds = [];
  for (var i = 0; i < ciclos.length; i++) {
    var c = ciclos[i];
    if (c.dataFim) {
      var d = diffDias(c.dataInicio, c.dataFim) + 1;
      if (d > 0 && d < 15) ds.push(d);
    }
  }
  return ds.length ? Math.round(media(ds)) : 5;
}

// Informações de um ciclo específico: duração real (se já há próximo ciclo registrado) ou estimada
function infoCiclo(reg, ciclos) {
  var ord = ciclosOrdenados(ciclos);
  var idx = -1;
  for (var i = 0; i < ord.length; i++) if (ord[i].id === reg.id) { idx = i; break; }
  var duracaoReal, estimado = false;
  if (idx > -1 && idx < ord.length - 1) {
    duracaoReal = diffDias(reg.dataInicio, ord[idx + 1].dataInicio);
  } else {
    duracaoReal = estimarDuracaoMedia(ciclos);
    estimado = true;
  }
  var menstruacaoDias = reg.dataFim ? diffDias(reg.dataInicio, reg.dataFim) + 1 : estimarDuracaoMenstruacao(ciclos);
  return { duracaoReal: duracaoReal, estimado: estimado, menstruacaoDias: menstruacaoDias, menstruacaoEstimada: !reg.dataFim };
}

function calcFaseCiclo(dataISO, ciclos, paraBadge) {
  if (!ciclos || ciclos.length === 0) return null;
  var ord = ciclosOrdenados(ciclos);
  var idx = -1;
  for (var i = 0; i < ord.length; i++) if (ord[i].dataInicio <= dataISO) idx = i;
  if (idx === -1) return null;
  var c = ord[idx];
  var info = infoCiclo(c, ciclos);
  var duracao = info.duracaoReal;
  var menstruacaoDias = info.menstruacaoDias;
  if (paraBadge && c.dataFim) menstruacaoDias = Math.max(menstruacaoDias - 1, 0);
  var dia = diffDias(c.dataInicio, dataISO) + 1;
  if (dia > duracao) dia = ((dia - 1) % duracao) + 1;
  // Ancora clínica: ovulação ocorre ~14 dias antes do próximo período (fase lútea é relativamente fixa)
  var ovulacaoDia = duracao - 14;
  var limMenstruacao = menstruacaoDias;
  var limFertil = Math.max(ovulacaoDia, limMenstruacao); // fim da janela fértil = dia da ovulação
  var inicioFertil = Math.max(limFertil - 5, limMenstruacao); // fértil = 5 dias antes da ovulação + o dia dela
  var limFolicular = Math.max(inicioFertil - 1, limMenstruacao);
  var inicioTpm = Math.max(duracao - 6, limFertil); // TPM = última semana (7 dias) antes do próximo período
  var limLutea = Math.max(inicioTpm - 1, limFertil);
  var fase, cor, emoji;
  if (dia <= limMenstruacao) { fase = 'Menstruação'; cor = '#FECDD3'; emoji = '🔴'; }
  else if (dia <= limFolicular) { fase = 'Folicular'; cor = '#D1FAE5'; emoji = '🌱'; }
  else if (dia <= limFertil) { fase = 'Fértil'; cor = '#FEF9C3'; emoji = '⭐'; }
  else if (dia <= limLutea) { fase = 'Lútea'; cor = '#DCC7F5'; emoji = '🌙'; }
  else { fase = 'TPM'; cor = '#FFCC99'; emoji = '😤'; }
  return { fase: fase, cor: cor, emoji: emoji, dia: dia, duracao: duracao, duracaoEstimada: info.estimado, menstruacaoDias: menstruacaoDias, dataInicioCiclo: c.dataInicio, dataFimCiclo: c.dataFim || null };
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===================== SELEÇÃO GENÉRICA (pills / quem) =====================
window._sel = {}; // guarda seleções ativas de forms abertos
window._editId = {};      // guarda {quem, id} do registro em edição, por módulo
window._editBuffer = {};  // guarda valores dos campos de texto/data/hora em edição, por módulo

function pillOn(grupo, valor) {
  return (window._sel[grupo] === valor) ? ' on' : '';
}
function pillMultiOn(grupo, valor) {
  var arr = window._sel[grupo];
  return (arr && arr.indexOf(valor) > -1) ? ' on' : '';
}
function eb(modulo, campo, padrao) {
  var buf = window._editBuffer[modulo];
  if (buf && buf[campo] !== undefined && buf[campo] !== null) return buf[campo];
  return padrao === undefined ? '' : padrao;
}
function cancelarEdicao(modulo) {
  window._editId[modulo] = null;
  window._editBuffer[modulo] = null;
  window._sel = {};
  if (MAPA_RERENDER_MODULO[modulo]) MAPA_RERENDER_MODULO[modulo]();
}
window.cancelarEdicao = cancelarEdicao;
var MAPA_RERENDER_MODULO = {};

function selectSingle(grupo, valor, el) {
  window._sel[grupo] = valor;
  var pais = el.parentElement;
  var botoes = pais.children;
  for (var i = 0; i < botoes.length; i++) {
    botoes[i].classList.remove('on');
  }
  el.classList.add('on');
}
window.selectSingle = selectSingle;

function selectMulti(grupo, valor, el) {
  if (!window._sel[grupo]) window._sel[grupo] = [];
  var arr = window._sel[grupo];
  var idx = arr.indexOf(valor);
  if (idx > -1) { arr.splice(idx, 1); el.classList.remove('on'); }
  else { arr.push(valor); el.classList.add('on'); }
}
window.selectMulti = selectMulti;

// ===================== FILTRO DE PERÍODO POR BLOCO (genérico, reutilizável) =====================
window._periodos = {};

function getPeriodo(key) {
  if (!window._periodos[key]) window._periodos[key] = { tipo: 'mes', de: null, ate: null };
  return window._periodos[key];
}

var MAPA_RERENDER = {};
function registrarRerender(key, fn) { MAPA_RERENDER[key] = fn; }

function setPeriodoBloco(key, tipo) {
  var p = getPeriodo(key);
  p.tipo = tipo;
  if (MAPA_RERENDER[key]) MAPA_RERENDER[key]();
}
window.setPeriodoBloco = setPeriodoBloco;

function atualizarPeriodoCustom(key) {
  var elDe = document.getElementById('periodo_' + key + '_de');
  var elAte = document.getElementById('periodo_' + key + '_ate');
  var p = getPeriodo(key);
  p.de = elDe ? elDe.value : null;
  p.ate = elAte ? elAte.value : null;
  if (MAPA_RERENDER[key]) MAPA_RERENDER[key]();
}
window.atualizarPeriodoCustom = atualizarPeriodoCustom;

function renderPeriodoPicker(key) {
  var p = getPeriodo(key);
  var opcoes = [['semana', 'Semana'], ['mes', 'Mês'], ['tudo', 'Tudo'], ['custom', 'Personalizado']];
  var html = '<div class="period-pick">';
  for (var i = 0; i < opcoes.length; i++) {
    var v = opcoes[i][0], l = opcoes[i][1];
    html += '<button type="button" class="' + (p.tipo === v ? 'on' : '') + '" onclick="setPeriodoBloco(\'' + key + '\',\'' + v + '\')">' + l + '</button>';
  }
  html += '</div>';
  if (p.tipo === 'custom') {
    html += '<div class="row2">';
    html += '<div class="field"><label>De</label><input class="input" type="date" id="periodo_' + key + '_de" value="' + (p.de || '') + '" onchange="atualizarPeriodoCustom(\'' + key + '\')"></div>';
    html += '<div class="field"><label>Até</label><input class="input" type="date" id="periodo_' + key + '_ate" value="' + (p.ate || '') + '" onchange="atualizarPeriodoCustom(\'' + key + '\')"></div>';
    html += '</div>';
  }
  return html;
}

function dataNoPeriodo(iso, key) {
  var p = getPeriodo(key);
  if (!iso) return false;
  if (p.tipo === 'tudo') return true;
  var hoje = hojeISO();
  if (p.tipo === 'semana') { var d = diffDias(iso, hoje); return d >= 0 && d <= 7; }
  if (p.tipo === 'mes') { var d2 = diffDias(iso, hoje); return d2 >= 0 && d2 <= 31; }
  if (p.tipo === 'custom') {
    if (!p.de || !p.ate) return true;
    return iso >= p.de && iso <= p.ate;
  }
  return true;
}

function filtrarPeriodo(arr, campoData, key) {
  var out = [];
  for (var i = 0; i < arr.length; i++) if (dataNoPeriodo(arr[i][campoData], key)) out.push(arr[i]);
  return out;
}
function tab(nome, el) {
  var secs = document.querySelectorAll('.sec');
  for (var i = 0; i < secs.length; i++) secs[i].classList.remove('on');
  document.getElementById('sec-' + nome).classList.add('on');
  var tabs = document.querySelectorAll('.tab');
  for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('on');
  el.classList.add('on');
}
window.tab = tab;

function fecharModal(id) { document.getElementById(id).classList.remove('on'); }
window.fecharModal = fecharModal;
function abrirModal(id) { document.getElementById(id).classList.add('on'); }
window.abrirModal = abrirModal;

// ===================== RENDER DISPATCHER =====================
function renderAll() {
  renderTopbar();
  renderSono();
  renderTreino();
  renderJuntos();
  renderIntimidade();
  renderSaude();
  renderCiclo();
  renderAlcool();
  renderComparativo();
  renderInsights();
  renderResumo();
  renderBiblia();
}
window.renderAll = renderAll;

function renderTopbar() {
  var sub = document.getElementById('topbarSub');
  var nome = window._userName || 'Casal';
  sub.textContent = 'Olá, ' + nome;
  var badgesEl = document.getElementById('topBadges');
  var fase = calcFaseCiclo(hojeISO(), window.ST.aline.ciclos, true);
  var html = '';
  if (fase) {
    if (fase.fase === 'Fértil') html += '<div class="badge badge-fertil">⭐ Fértil</div>';
    if (fase.fase === 'TPM') html += '<div class="badge badge-tpm">😤 TPM</div>';
    if (fase.fase === 'Menstruação') html += '<div class="badge badge-periodo">🔴 Período</div>';
  }
  badgesEl.innerHTML = html;
}

// ===================== SONO =====================
function renderSono() {
  var el = document.getElementById('sec-sono');
  var editando = window._editId.sono;
  var html = '';
  html += '<div class="card">';
  html += '<div class="card-title">😴 ' + (editando ? 'Editar registro de sono' : 'Registrar sono') + '</div>';
  html += '<div class="card-sub">Selecione quem e preencha os horários</div>';
  html += '<div class="field"><div class="quem-pick" id="sonoQuemPick">';
  html += '<button type="button" class="quem-btn q-tarcisio' + pillOn('sonoQuem', 'tarcisio') + '" onclick="selectSingle(\'sonoQuem\',\'tarcisio\',this)">👨 Tarcísio</button>';
  html += '<button type="button" class="quem-btn q-aline' + pillOn('sonoQuem', 'aline') + '" onclick="selectSingle(\'sonoQuem\',\'aline\',this)">👩 Aline</button>';
  html += '</div></div>';
  html += '<div class="row2">';
  html += '<div class="field"><label>Horário de dormir</label><input class="input" type="time" id="sonoDormir" value="' + eb('sono', 'dormir') + '"></div>';
  html += '<div class="field"><label>Horário de acordar</label><input class="input" type="time" id="sonoAcordar" value="' + eb('sono', 'acordar') + '"></div>';
  html += '</div>';
  html += '<div class="field"><label>Data (da noite de dormir)</label><input class="input" type="date" id="sonoData" value="' + eb('sono', 'data', hojeISO()) + '"></div>';
  html += '<div class="field"><label>Despertares (número, sem contar banheiro)</label><input class="input" type="number" id="sonoDespertares" value="' + eb('sono', 'despertares', 0) + '"></div>';
  html += '<div class="field"><label>Tempo total acordado durante a noite (min, opcional)</label><input class="input" type="number" id="sonoIntervalo" value="' + eb('sono', 'intervalo', 0) + '"></div>';
  html += '<div class="field"><label>Observação (opcional)</label><textarea class="input" id="sonoObs">' + eb('sono', 'obs') + '</textarea></div>';
  html += '<button class="btn btn-primary" onclick="salvarSono()">' + (editando ? 'Salvar edição' : 'Salvar registro') + '</button>';
  if (editando) html += ' <button class="btn btn-ghost" onclick="cancelarEdicao(\'sono\')" style="margin-top:8px;">Cancelar edição</button>';
  html += '</div>';

  html += '<div class="card"><div class="card-title">Estatísticas</div>' + renderPeriodoPicker('sono') + '</div>';
  html += renderStatsSono();
  html += '<div class="card"><div class="card-title">Histórico</div><div id="sonoLista"></div></div>';
  el.innerHTML = html;
  renderListaSono();
}

function renderStatsSono() {
  var st = window.ST;
  var durT = [], durA = [], desT = [], desA = [];
  var sonoTF = filtrarPeriodo(st.tarcisio.sono, 'data', 'sono');
  var sonoAF = filtrarPeriodo(st.aline.sono, 'data', 'sono');
  for (var i = 0; i < sonoTF.length; i++) {
    var r = sonoTF[i];
    var d = calcSonoReal(r.dormir, r.acordar, r.intervalo);
    if (d !== null) durT.push(d);
    desT.push(r.despertares || 0);
  }
  for (var j = 0; j < sonoAF.length; j++) {
    var r2 = sonoAF[j];
    var d2 = calcSonoReal(r2.dormir, r2.acordar, r2.intervalo);
    if (d2 !== null) durA.push(d2);
    desA.push(r2.despertares || 0);
  }
  var html = '<div class="card"><div class="card-title">Comparativo de sono</div>';
  html += '<div class="stat-grid">';
  html += '<div class="stat-box"><div class="num">' + minParaHoras(media(durT)) + '</div><div class="lbl">👨 Tarcísio — média</div></div>';
  html += '<div class="stat-box"><div class="num">' + minParaHoras(media(durA)) + '</div><div class="lbl">👩 Aline — média</div></div>';
  html += '<div class="stat-box"><div class="num">' + fmt1(media(desT)) + '</div><div class="lbl">Despertares/noite — Tarcísio</div></div>';
  html += '<div class="stat-box"><div class="num">' + fmt1(media(desA)) + '</div><div class="lbl">Despertares/noite — Aline</div></div>';
  html += '</div></div>';
  return html;
}

function renderListaSono() {
  var todos = [];
  for (var i = 0; i < window.ST.tarcisio.sono.length; i++) {
    var r = window.ST.tarcisio.sono[i]; r._quem = 'tarcisio'; todos.push(r);
  }
  for (var j = 0; j < window.ST.aline.sono.length; j++) {
    var r2 = window.ST.aline.sono[j]; r2._quem = 'aline'; todos.push(r2);
  }
  todos.sort(function (a, b) { return a.data < b.data ? 1 : -1; });
  var html = '';
  if (todos.length === 0) html = '<div class="li-sub">Nenhum registro ainda.</div>';
  for (var k = 0; k < todos.length; k++) {
    var reg = todos[k];
    var quemLabel = reg._quem === 'tarcisio' ? '👨 Tarcísio' : '👩 Aline';
    var dur = calcSonoReal(reg.dormir, reg.acordar, reg.intervalo);
    html += '<div class="list-item">';
    html += '<div><div class="li-main">' + quemLabel + ' — ' + fmtDate(reg.data) + '</div>';
    html += '<div class="li-sub">' + reg.dormir + ' → ' + reg.acordar + (reg.intervalo ? ' (−' + reg.intervalo + 'min acordado)' : '') + ' · sono real: ' + minParaHoras(dur) + ' · ' + (reg.despertares || 0) + ' despertar(es)</div>';
    if (reg.obs) html += '<div class="li-sub">' + esc(reg.obs) + '</div>';
    html += '</div>';
    html += '<div class="li-actions"><button onclick="editarSono(\'' + reg._quem + '\',' + reg.id + ')">✏️</button><button onclick="excluirSono(\'' + reg._quem + '\',' + reg.id + ')">🗑</button></div>';
    html += '</div>';
  }
  document.getElementById('sonoLista').innerHTML = html;
}

function editarSono(quem, id) {
  var arr = window.ST[quem].sono;
  var reg = null;
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { reg = arr[i]; break; }
  if (!reg) return;
  window._sel = {};
  window._sel.sonoQuem = quem;
  window._editId.sono = { quem: quem, id: id };
  window._editBuffer.sono = { dormir: reg.dormir, acordar: reg.acordar, data: reg.data, despertares: reg.despertares, intervalo: reg.intervalo, obs: reg.obs };
  renderSono();
}
window.editarSono = editarSono;

function salvarSono() {
  var quem = window._sel.sonoQuem;
  if (!quem) { alert('Selecione quem (Tarcísio ou Aline)'); return; }
  var dormir = document.getElementById('sonoDormir').value;
  var acordar = document.getElementById('sonoAcordar').value;
  var data = document.getElementById('sonoData').value || hojeISO();
  if (!dormir || !acordar) { alert('Preencha os horários'); return; }
  var editando = window._editId.sono;
  var reg = {
    id: editando ? editando.id : uid(),
    data: data,
    dormir: dormir,
    acordar: acordar,
    despertares: Number(document.getElementById('sonoDespertares').value) || 0,
    intervalo: Number(document.getElementById('sonoIntervalo').value) || 0,
    obs: document.getElementById('sonoObs').value || '',
    registradoPor: window._userName || null
  };
  if (editando) {
    var arrAntigo = window.ST[editando.quem].sono;
    for (var i = 0; i < arrAntigo.length; i++) if (arrAntigo[i].id === editando.id) { arrAntigo.splice(i, 1); break; }
    window._editId.sono = null;
    window._editBuffer.sono = null;
  }
  window.ST[quem].sono.push(reg);
  window.saveState();
  window._sel = {};
  renderSono();
}
window.salvarSono = salvarSono;

function excluirSono(quem, id) {
  if (!confirm('Excluir este registro de sono?')) return;
  var arr = window.ST[quem].sono;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].id === id) { arr.splice(i, 1); break; }
  }
  window.saveState();
  renderSono();
}
window.excluirSono = excluirSono;

// ===================== TREINO =====================
var TIPOS_TREINO = [
  { v: 'corrida', l: '🏃 Corrida' }, { v: 'musculacao', l: '💪 Musculação' },
  { v: 'natacao', l: '🏊 Natação' }, { v: 'caminhada', l: '🚶 Caminhada' },
  { v: 'yoga', l: '🧘 Yoga' }, { v: 'ciclismo', l: '🚴 Ciclismo' },
  { v: 'futebol', l: '⚽ Futebol' }, { v: 'volei', l: '🏐 Vôlei' },
  { v: 'ping_pong', l: '🏓 Ping Pong' }, { v: 'beach_tenis', l: '🎾 Beach Tênis' },
  { v: 'pilates', l: '🤸 Pilates' }, { v: 'outro', l: '➕ Outro' }
];

function renderTreino() {
  var el = document.getElementById('sec-treino');
  var editando = window._editId.treino;
  var html = '';
  html += '<div class="card"><div class="card-title">🏃 ' + (editando ? 'Editar treino' : 'Registrar atividade física') + '</div>';
  html += '<div class="field"><div class="quem-pick">';
  html += '<button type="button" class="quem-btn q-tarcisio' + pillOn('treinoQuem', 'tarcisio') + '" onclick="selectSingle(\'treinoQuem\',\'tarcisio\',this)">👨 Tarcísio</button>';
  html += '<button type="button" class="quem-btn q-aline' + pillOn('treinoQuem', 'aline') + '" onclick="selectSingle(\'treinoQuem\',\'aline\',this)">👩 Aline</button>';
  html += '<button type="button" class="quem-btn q-juntos' + pillOn('treinoQuem', 'juntos') + '" onclick="selectSingle(\'treinoQuem\',\'juntos\',this)">👫 Juntos</button>';
  html += '</div></div>';
  html += '<div class="field"><label>Tipo</label><div class="pill-row">';
  for (var i = 0; i < TIPOS_TREINO.length; i++) {
    html += '<button type="button" class="tipo-pill' + pillOn('treinoTipo', TIPOS_TREINO[i].v) + '" onclick="selectSingle(\'treinoTipo\',\'' + TIPOS_TREINO[i].v + '\',this)">' + TIPOS_TREINO[i].l + '</button>';
  }
  html += '</div></div>';
  html += '<div class="field"><label>Data</label><input class="input" type="date" id="treinoData" value="' + eb('treino', 'data', hojeISO()) + '"></div>';
  html += '<div class="row2">';
  html += '<div class="field"><label>Início</label><input class="input" type="time" id="treinoInicio" value="' + eb('treino', 'inicio') + '"></div>';
  html += '<div class="field"><label>Fim</label><input class="input" type="time" id="treinoFim" value="' + eb('treino', 'fim') + '"></div>';
  html += '</div>';
  html += '<div class="field"><label>Intensidade</label><div class="pill-row">';
  html += '<button type="button" class="tipo-pill' + pillOn('treinoIntensidade', 'leve') + '" onclick="selectSingle(\'treinoIntensidade\',\'leve\',this)">Leve</button>';
  html += '<button type="button" class="tipo-pill' + pillOn('treinoIntensidade', 'moderada') + '" onclick="selectSingle(\'treinoIntensidade\',\'moderada\',this)">Moderada</button>';
  html += '<button type="button" class="tipo-pill' + pillOn('treinoIntensidade', 'intensa') + '" onclick="selectSingle(\'treinoIntensidade\',\'intensa\',this)">Intensa</button>';
  html += '</div></div>';
  html += '<div class="field"><label>Observação (opcional)</label><textarea class="input" id="treinoObs">' + eb('treino', 'obs') + '</textarea></div>';
  html += '<button class="btn btn-primary" onclick="salvarTreino()">' + (editando ? 'Salvar edição' : 'Salvar treino') + '</button>';
  if (editando) html += ' <button class="btn btn-ghost" onclick="cancelarEdicao(\'treino\')" style="margin-top:8px;">Cancelar edição</button>';
  html += '</div>';
  html += '<div class="card"><div class="card-title">Estatísticas</div>' + renderPeriodoPicker('treino') + '</div>';
  html += renderStatsTreino();
  html += '<div class="card"><div class="card-title">Histórico</div><div id="treinoLista"></div></div>';
  el.innerHTML = html;
  renderListaTreino();
}

function tipoTreinoLabel(v) {
  for (var i = 0; i < TIPOS_TREINO.length; i++) if (TIPOS_TREINO[i].v === v) return TIPOS_TREINO[i].l;
  return v;
}

function renderStatsTreino() {
  var treinoTF = filtrarPeriodo(window.ST.tarcisio.treinos, 'data', 'treino');
  var treinoAF = filtrarPeriodo(window.ST.aline.treinos, 'data', 'treino');
  var freqT = treinoTF.length, freqA = treinoAF.length;
  var minT = 0, minA = 0;
  for (var i = 0; i < treinoTF.length; i++) { var d = calcDuracaoAtividade(treinoTF[i].inicio, treinoTF[i].fim); if (d) minT += d; }
  for (var j = 0; j < treinoAF.length; j++) { var d2 = calcDuracaoAtividade(treinoAF[j].inicio, treinoAF[j].fim); if (d2) minA += d2; }
  var html = '<div class="card"><div class="card-title">Resumo do período</div><div class="stat-grid">';
  html += '<div class="stat-box"><div class="num">' + freqT + '</div><div class="lbl">Treinos — Tarcísio</div></div>';
  html += '<div class="stat-box"><div class="num">' + freqA + '</div><div class="lbl">Treinos — Aline</div></div>';
  html += '<div class="stat-box"><div class="num">' + minParaHoras(minT) + '</div><div class="lbl">Total — Tarcísio</div></div>';
  html += '<div class="stat-box"><div class="num">' + minParaHoras(minA) + '</div><div class="lbl">Total — Aline</div></div>';
  html += '</div></div>';

  var porTipo = {};
  for (var k = 0; k < TIPOS_TREINO.length; k++) porTipo[TIPOS_TREINO[k].v] = { tarcisio: 0, aline: 0 };
  for (var m = 0; m < treinoTF.length; m++) { var t1 = treinoTF[m].tipo || 'outro'; if (!porTipo[t1]) porTipo[t1] = { tarcisio: 0, aline: 0 }; porTipo[t1].tarcisio++; }
  for (var n = 0; n < treinoAF.length; n++) { var t2 = treinoAF[n].tipo || 'outro'; if (!porTipo[t2]) porTipo[t2] = { tarcisio: 0, aline: 0 }; porTipo[t2].aline++; }
  html += '<div class="card"><div class="card-title">Por tipo de treino</div><table class="tbl"><tr><th>Tipo</th><th>Tarcísio</th><th>Aline</th></tr>';
  for (var p = 0; p < TIPOS_TREINO.length; p++) {
    var tv = TIPOS_TREINO[p].v;
    var c = porTipo[tv];
    if (c.tarcisio === 0 && c.aline === 0) continue;
    html += '<tr><td>' + tipoTreinoLabel(tv) + '</td><td>' + c.tarcisio + '</td><td>' + c.aline + '</td></tr>';
  }
  html += '</table></div>';
  return html;
}

function renderListaTreino() {
  var todos = [];
  for (var i = 0; i < window.ST.tarcisio.treinos.length; i++) { var r = window.ST.tarcisio.treinos[i]; r._quem = 'tarcisio'; todos.push(r); }
  for (var j = 0; j < window.ST.aline.treinos.length; j++) { var r2 = window.ST.aline.treinos[j]; r2._quem = 'aline'; todos.push(r2); }
  todos.sort(function (a, b) { return a.data < b.data ? 1 : -1; });
  var html = '';
  if (todos.length === 0) html = '<div class="li-sub">Nenhum registro ainda.</div>';
  for (var k = 0; k < todos.length; k++) {
    var reg = todos[k];
    var quemLabel = reg._quem === 'tarcisio' ? '👨 Tarcísio' : (reg._quem === 'aline' ? '👩 Aline' : '👫 Juntos');
    var dur = calcDuracaoAtividade(reg.inicio, reg.fim);
    html += '<div class="list-item"><div>';
    html += '<div class="li-main">' + quemLabel + ' — ' + tipoTreinoLabel(reg.tipo) + '</div>';
    html += '<div class="li-sub">' + fmtDate(reg.data) + ' · ' + reg.inicio + '–' + reg.fim + ' (' + minParaHoras(dur) + ') · ' + (reg.intensidade || '') + '</div>';
    if (reg.obs) html += '<div class="li-sub">' + esc(reg.obs) + '</div>';
    html += '</div><div class="li-actions"><button onclick="editarTreino(\'' + reg._quem + '\',' + reg.id + ')">✏️</button><button onclick="excluirTreino(\'' + reg._quem + '\',' + reg.id + ')">🗑</button></div></div>';
  }
  document.getElementById('treinoLista').innerHTML = html;
}

function editarTreino(quem, id) {
  var arr = window.ST[quem].treinos;
  var reg = null;
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { reg = arr[i]; break; }
  if (!reg) return;
  window._sel = {};
  window._sel.treinoQuem = quem;
  window._sel.treinoTipo = reg.tipo;
  window._sel.treinoIntensidade = reg.intensidade;
  window._editId.treino = { quem: quem, id: id };
  window._editBuffer.treino = { data: reg.data, inicio: reg.inicio, fim: reg.fim, obs: reg.obs };
  renderTreino();
}
window.editarTreino = editarTreino;

function salvarTreino() {
  var quem = window._sel.treinoQuem;
  var tipo = window._sel.treinoTipo;
  var intensidade = window._sel.treinoIntensidade;
  if (!quem) { alert('Selecione quem'); return; }
  var inicio = document.getElementById('treinoInicio').value;
  var fim = document.getElementById('treinoFim').value;
  if (!inicio || !fim) { alert('Preencha horário de início e fim'); return; }
  var editando = window._editId.treino;
  var reg = {
    id: editando ? editando.id : uid(), data: document.getElementById('treinoData').value || hojeISO(),
    tipo: tipo || 'outro', inicio: inicio, fim: fim, intensidade: intensidade || 'moderada',
    obs: document.getElementById('treinoObs').value || '', registradoPor: window._userName || null
  };
  if (editando) {
    var arrAntigo = window.ST[editando.quem].treinos;
    for (var i = 0; i < arrAntigo.length; i++) if (arrAntigo[i].id === editando.id) { arrAntigo.splice(i, 1); break; }
    window._editId.treino = null;
    window._editBuffer.treino = null;
  }
  window.ST[quem].treinos.push(reg);
  window.saveState();
  window._sel = {};
  renderTreino();
}
window.salvarTreino = salvarTreino;

function excluirTreino(quem, id) {
  if (!confirm('Excluir este treino?')) return;
  var arr = window.ST[quem].treinos;
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { arr.splice(i, 1); break; }
  window.saveState();
  renderTreino();
}
window.excluirTreino = excluirTreino;

// ===================== TEMPO JUNTOS =====================
var TIPOS_JUNTOS = [
  { v: 'jantar_fora', l: '🍽️ Jantar/Almoço fora' }, { v: 'jantar_casa', l: '🏠 Jantar em casa a dois' },
  { v: 'serie_filme', l: '📺 Série/filme' }, { v: 'passeio', l: '🚶 Passeio juntos' },
  { v: 'shopping', l: '🛍️ Shopping' }, { v: 'poker', l: '🃏 Poker' },
  { v: 'receber_pessoas', l: '🏡 Receber pessoas em casa' }, { v: 'casa_amigos', l: '👥 Casa de amigos' },
  { v: 'outro', l: '➕ Outro' }
];

function juntosQuemLabel(v) {
  if (v === 'tarcisio') return '👨 Tarcísio';
  if (v === 'aline') return '👩 Aline';
  if (v === 'familia') return '👨‍👩‍👦‍👦 Família';
  return '👫 Casal';
}

function tipoJuntosLabel(v) {
  for (var i = 0; i < TIPOS_JUNTOS.length; i++) if (TIPOS_JUNTOS[i].v === v) return TIPOS_JUNTOS[i].l;
  return v;
}

function renderJuntos() {
  var el = document.getElementById('sec-juntos');
  var editando = window._editId.juntos;
  var html = '';
  html += '<div class="card"><div class="card-title">🎉 ' + (editando ? 'Editar evento de lazer' : 'Registrar tempo juntos') + '</div>';
  html += '<div class="field"><label>Quem participou</label><div class="pill-row">';
  html += '<button type="button" class="quem-btn q-tarcisio' + pillOn('juntosQuem', 'tarcisio') + '" onclick="selectSingle(\'juntosQuem\',\'tarcisio\',this)">👨 Tarcísio</button>';
  html += '<button type="button" class="quem-btn q-aline' + pillOn('juntosQuem', 'aline') + '" onclick="selectSingle(\'juntosQuem\',\'aline\',this)">👩 Aline</button>';
  html += '<button type="button" class="quem-btn q-juntos' + pillOn('juntosQuem', 'casal') + '" onclick="selectSingle(\'juntosQuem\',\'casal\',this)">👫 Casal</button>';
  html += '<button type="button" class="quem-btn q-juntos' + pillOn('juntosQuem', 'familia') + '" onclick="selectSingle(\'juntosQuem\',\'familia\',this)">👨‍👩‍👦‍👦 Família</button>';
  html += '</div></div>';
  html += '<div class="field"><label>Tipo</label><div class="pill-row">';
  for (var i = 0; i < TIPOS_JUNTOS.length; i++) html += '<button type="button" class="tipo-pill' + pillOn('juntosTipo', TIPOS_JUNTOS[i].v) + '" onclick="selectSingle(\'juntosTipo\',\'' + TIPOS_JUNTOS[i].v + '\',this)">' + TIPOS_JUNTOS[i].l + '</button>';
  html += '</div></div>';
  html += '<div class="row2">';
  html += '<div class="field"><label>Data</label><input class="input" type="date" id="juntosData" value="' + eb('juntos', 'data', hojeISO()) + '"></div>';
  html += '<div class="field"><label>Duração (min, opcional)</label><input class="input" type="number" id="juntosDuracao" value="' + eb('juntos', 'duracao') + '"></div>';
  html += '</div>';
  html += '<div class="field"><label>Observação (opcional)</label><textarea class="input" id="juntosObs">' + eb('juntos', 'obs') + '</textarea></div>';
  html += '<button class="btn btn-primary" onclick="salvarJuntos()">' + (editando ? 'Salvar edição' : 'Salvar registro') + '</button>';
  if (editando) html += ' <button class="btn btn-ghost" onclick="cancelarEdicao(\'juntos\')" style="margin-top:8px;">Cancelar edição</button>';
  html += '</div>';
  html += '<div class="card"><div class="card-title">Estatísticas</div>' + renderPeriodoPicker('juntos') + '</div>';
  html += renderStatsJuntos();
  html += '<div class="card"><div class="card-title">Histórico</div><div id="juntosLista"></div></div>';
  el.innerHTML = html;
  renderListaJuntos();
}

function renderStatsJuntos() {
  var arr = filtrarPeriodo(window.ST.juntos.momentos, 'data', 'juntos');
  var contagem = {}, ultimo = {}, porQuem = { tarcisio: 0, aline: 0, casal: 0, familia: 0 };
  var porTipoQuem = {};
  for (var i = 0; i < TIPOS_JUNTOS.length; i++) { contagem[TIPOS_JUNTOS[i].v] = 0; porTipoQuem[TIPOS_JUNTOS[i].v] = { tarcisio: 0, aline: 0, casal: 0, familia: 0 }; }
  for (var j = 0; j < arr.length; j++) {
    var r = arr[j];
    contagem[r.tipo] = (contagem[r.tipo] || 0) + 1;
    porQuem[r.quem] = (porQuem[r.quem] || 0) + 1;
    if (!porTipoQuem[r.tipo]) porTipoQuem[r.tipo] = { tarcisio: 0, aline: 0, casal: 0, familia: 0 };
    porTipoQuem[r.tipo][r.quem] = (porTipoQuem[r.tipo][r.quem] || 0) + 1;
    if (!ultimo[r.tipo] || r.data > ultimo[r.tipo]) ultimo[r.tipo] = r.data;
  }
  var html = '<div class="card"><div class="card-title">Por pessoa</div><div class="stat-grid">';
  html += '<div class="stat-box"><div class="num">' + (porQuem.tarcisio || 0) + '</div><div class="lbl">👨 Tarcísio</div></div>';
  html += '<div class="stat-box"><div class="num">' + (porQuem.aline || 0) + '</div><div class="lbl">👩 Aline</div></div>';
  html += '<div class="stat-box"><div class="num">' + (porQuem.casal || 0) + '</div><div class="lbl">👫 Casal</div></div>';
  html += '<div class="stat-box"><div class="num">' + (porQuem.familia || 0) + '</div><div class="lbl">👨‍👩‍👦‍👦 Família</div></div>';
  html += '</div></div>';
  html += '<div class="card"><div class="card-title">Por tipo de evento e pessoa</div><table class="tbl"><tr><th>Tipo</th><th>👨</th><th>👩</th><th>👫</th><th>👨‍👩‍👦‍👦</th><th>Última vez</th></tr>';
  for (var k = 0; k < TIPOS_JUNTOS.length; k++) {
    var t = TIPOS_JUNTOS[k];
    if ((contagem[t.v] || 0) === 0) continue;
    var pq = porTipoQuem[t.v];
    var dias = ultimo[t.v] ? diffDias(ultimo[t.v], hojeISO()) + 'd atrás' : '—';
    html += '<tr><td>' + t.l + '</td><td>' + (pq.tarcisio || 0) + '</td><td>' + (pq.aline || 0) + '</td><td>' + (pq.casal || 0) + '</td><td>' + (pq.familia || 0) + '</td><td>' + dias + '</td></tr>';
  }
  html += '</table></div>';
  return html;
}

function renderListaJuntos() {
  var arr = window.ST.juntos.momentos.slice().sort(function (a, b) { return a.data < b.data ? 1 : -1; });
  var html = '';
  if (arr.length === 0) html = '<div class="li-sub">Nenhum registro ainda.</div>';
  for (var i = 0; i < arr.length; i++) {
    var reg = arr[i];
    html += '<div class="list-item"><div>';
    html += '<div class="li-main">' + tipoJuntosLabel(reg.tipo) + ' — ' + juntosQuemLabel(reg.quem) + '</div>';
    html += '<div class="li-sub">' + fmtDate(reg.data) + (reg.duracao ? ' · ' + reg.duracao + ' min' : '') + '</div>';
    if (reg.obs) html += '<div class="li-sub">' + esc(reg.obs) + '</div>';
    html += '</div><div class="li-actions"><button onclick="editarJuntos(' + reg.id + ')">✏️</button><button onclick="excluirJuntos(' + reg.id + ')">🗑</button></div></div>';
  }
  document.getElementById('juntosLista').innerHTML = html;
}

function editarJuntos(id) {
  var arr = window.ST.juntos.momentos;
  var reg = null;
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { reg = arr[i]; break; }
  if (!reg) return;
  window._sel = {};
  window._sel.juntosQuem = reg.quem;
  window._sel.juntosTipo = reg.tipo;
  window._editId.juntos = { id: id };
  window._editBuffer.juntos = { data: reg.data, duracao: reg.duracao, obs: reg.obs };
  renderJuntos();
}
window.editarJuntos = editarJuntos;

function salvarJuntos() {
  var quem = window._sel.juntosQuem;
  var tipo = window._sel.juntosTipo;
  if (!tipo) { alert('Selecione o tipo'); return; }
  var editando = window._editId.juntos;
  var reg = {
    id: editando ? editando.id : uid(), data: document.getElementById('juntosData').value || hojeISO(),
    quem: quem || 'casal', tipo: tipo,
    duracao: Number(document.getElementById('juntosDuracao').value) || null,
    obs: document.getElementById('juntosObs').value || '', registradoPor: window._userName || null
  };
  if (editando) {
    var arrAntigo = window.ST.juntos.momentos;
    for (var i = 0; i < arrAntigo.length; i++) if (arrAntigo[i].id === editando.id) { arrAntigo.splice(i, 1); break; }
    window._editId.juntos = null;
    window._editBuffer.juntos = null;
  }
  window.ST.juntos.momentos.push(reg);
  window.saveState();
  window._sel = {};
  renderJuntos();
}
window.salvarJuntos = salvarJuntos;

function excluirJuntos(id) {
  if (!confirm('Excluir este registro?')) return;
  var arr = window.ST.juntos.momentos;
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { arr.splice(i, 1); break; }
  window.saveState();
  renderJuntos();
}
window.excluirJuntos = excluirJuntos;

// ===================== INTIMIDADE =====================
function renderIntimidade() {
  var el = document.getElementById('sec-intimidade');
  var editando = window._editId.intimidade;
  var fase = calcFaseCiclo(document.getElementById('intimData') ? document.getElementById('intimData').value || hojeISO() : hojeISO(), window.ST.aline.ciclos);
  var html = '';
  html += '<div class="card"><div class="card-title">❤️ ' + (editando ? 'Editar encontro' : 'Registrar encontro') + '</div>';
  html += '<div class="row2">';
  html += '<div class="field"><label>Data</label><input class="input" type="date" id="intimData" value="' + eb('intimidade', 'data', hojeISO()) + '" onchange="renderIntimidade()"></div>';
  html += '<div class="field"><label>Horário</label><input class="input" type="time" id="intimHora" value="' + eb('intimidade', 'hora', agoraHora()) + '"></div>';
  html += '</div>';
  html += '<div class="field"><label>Iniciativa</label><div class="pill-row">';
  html += '<button type="button" class="quem-btn q-tarcisio' + pillOn('intimIniciativa', 'tarcisio') + '" onclick="selectSingle(\'intimIniciativa\',\'tarcisio\',this)">👨 Tarcísio</button>';
  html += '<button type="button" class="quem-btn q-aline' + pillOn('intimIniciativa', 'aline') + '" onclick="selectSingle(\'intimIniciativa\',\'aline\',this)">👩 Aline</button>';
  html += '<button type="button" class="quem-btn q-juntos' + pillOn('intimIniciativa', 'mutuo') + '" onclick="selectSingle(\'intimIniciativa\',\'mutuo\',this)">👫 Mútuo</button>';
  html += '</div></div>';
  html += '<div class="field"><label>Consumado</label><div class="pill-row">';
  html += '<button type="button" class="tipo-pill' + pillOn('intimConsumado', 'sim') + '" onclick="selectSingle(\'intimConsumado\',\'sim\',this)">✅ Sim</button>';
  html += '<button type="button" class="tipo-pill' + pillOn('intimConsumado', 'nao') + '" onclick="selectSingle(\'intimConsumado\',\'nao\',this)">❌ Não</button>';
  html += '</div></div>';
  html += '<div class="field"><label>Local</label><div class="pill-row">';
  html += '<button type="button" class="tipo-pill' + pillOn('intimLocal', 'casa') + '" onclick="selectSingle(\'intimLocal\',\'casa\',this)">🏠 Casa</button>';
  html += '<button type="button" class="tipo-pill' + pillOn('intimLocal', 'hotel') + '" onclick="selectSingle(\'intimLocal\',\'hotel\',this)">🏨 Hotel</button>';
  html += '<button type="button" class="tipo-pill' + pillOn('intimLocal', 'casa_familiares') + '" onclick="selectSingle(\'intimLocal\',\'casa_familiares\',this)">👨‍👩‍👧 Casa de familiares</button>';
  html += '<button type="button" class="tipo-pill' + pillOn('intimLocal', 'outros') + '" onclick="selectSingle(\'intimLocal\',\'outros\',this)">➕ Outros</button>';
  html += '</div></div>';
  html += '<div class="field"><label>Cômodo</label><div class="pill-row">';
  html += '<button type="button" class="tipo-pill' + pillOn('intimComodo', 'quarto') + '" onclick="selectSingle(\'intimComodo\',\'quarto\',this)">🛏️ Quarto</button>';
  html += '<button type="button" class="tipo-pill' + pillOn('intimComodo', 'sala') + '" onclick="selectSingle(\'intimComodo\',\'sala\',this)">🛋️ Sala</button>';
  html += '<button type="button" class="tipo-pill' + pillOn('intimComodo', 'banheiro') + '" onclick="selectSingle(\'intimComodo\',\'banheiro\',this)">🚿 Banheiro</button>';
  html += '<button type="button" class="tipo-pill' + pillOn('intimComodo', 'varanda') + '" onclick="selectSingle(\'intimComodo\',\'varanda\',this)">🌇 Varanda</button>';
  html += '<button type="button" class="tipo-pill' + pillOn('intimComodo', 'outro') + '" onclick="selectSingle(\'intimComodo\',\'outro\',this)">➕ Outro</button>';
  html += '</div></div>';
  if (fase) html += '<div class="li-sub">Fase do ciclo: ' + fase.emoji + ' ' + fase.fase + '</div>';
  html += '<div class="field" style="margin-top:8px;"><textarea class="input" id="intimObs" placeholder="Observação (opcional)">' + eb('intimidade', 'obs') + '</textarea></div>';
  html += '<button class="btn btn-primary" onclick="salvarIntimidade()">' + (editando ? 'Salvar edição' : 'Salvar') + '</button>';
  if (editando) html += ' <button class="btn btn-ghost" onclick="cancelarEdicao(\'intimidade\')" style="margin-top:8px;">Cancelar edição</button>';
  html += '</div>';
  html += '<div class="card"><div class="card-title">Estatísticas</div>' + renderPeriodoPicker('intimidade') + '</div>';
  html += renderStatsIntimidade();
  html += '<div class="card"><div class="card-title">Histórico</div><div id="intimLista"></div></div>';
  el.innerHTML = html;
  renderListaIntimidade();
}

function renderStatsIntimidade() {
  var arr = filtrarPeriodo(window.ST.intimidade.encontros, 'data', 'intimidade');
  var total = arr.length;
  var iniciativa = { tarcisio: 0, aline: 0, mutuo: 0 };
  var consumadosPorIniciativa = { tarcisio: 0, aline: 0, mutuo: 0 };
  var consumados = 0;
  var porFase = {};
  var porLocal = {}, porComodo = {};
  for (var i = 0; i < arr.length; i++) {
    var r = arr[i];
    iniciativa[r.iniciativa] = (iniciativa[r.iniciativa] || 0) + 1;
    if (r.consumado === 'sim') {
      consumados++;
      consumadosPorIniciativa[r.iniciativa] = (consumadosPorIniciativa[r.iniciativa] || 0) + 1;
    }
    var f = calcFaseCiclo(r.data, window.ST.aline.ciclos);
    if (f) porFase[f.fase] = (porFase[f.fase] || 0) + 1;
    porLocal[r.local] = (porLocal[r.local] || 0) + 1;
    porComodo[r.comodo] = (porComodo[r.comodo] || 0) + 1;
  }
  var taxa = total > 0 ? Math.round((consumados / total) * 100) : 0;
  var html = '<div class="card"><div class="card-title">Resumo do período</div><div class="stat-grid">';
  html += '<div class="stat-box"><div class="num">' + total + '</div><div class="lbl">Frequência total</div></div>';
  html += '<div class="stat-box"><div class="num">' + taxa + '%</div><div class="lbl">Taxa de consumação geral</div></div>';
  html += '<div class="stat-box"><div class="num">' + (iniciativa.tarcisio || 0) + ' / ' + (iniciativa.aline || 0) + ' / ' + (iniciativa.mutuo || 0) + '</div><div class="lbl">Iniciativa T/A/Mútuo</div></div>';
  var faseTop = null, faseTopN = 0;
  for (var k in porFase) { if (porFase[k] > faseTopN) { faseTopN = porFase[k]; faseTop = k; } }
  html += '<div class="stat-box"><div class="num">' + (faseTop || '—') + '</div><div class="lbl">Fase com mais frequência</div></div>';
  html += '</div></div>';

  html += '<div class="card"><div class="card-title">Taxa de consumação por origem da iniciativa</div><table class="tbl"><tr><th>Iniciativa</th><th>Total</th><th>Consumados</th><th>Taxa</th></tr>';
  var inicOrdem = [['tarcisio', '👨 Tarcísio'], ['aline', '👩 Aline'], ['mutuo', '👫 Mútuo']];
  for (var m = 0; m < inicOrdem.length; m++) {
    var iv = inicOrdem[m][0];
    var totalI = iniciativa[iv] || 0;
    var consI = consumadosPorIniciativa[iv] || 0;
    var taxaI = totalI > 0 ? Math.round((consI / totalI) * 100) : 0;
    html += '<tr><td>' + inicOrdem[m][1] + '</td><td>' + totalI + '</td><td>' + consI + '</td><td>' + taxaI + '%</td></tr>';
  }
  html += '</table></div>';

  var localLbl = { casa: '🏠 Casa', hotel: '🏨 Hotel', casa_familiares: '👨‍👩‍👧 Casa de familiares', outros: '➕ Outros' };
  var comodoLbl = { quarto: '🛏️ Quarto', sala: '🛋️ Sala', banheiro: '🚿 Banheiro', varanda: '🌇 Varanda', outro: '➕ Outro' };
  html += '<div class="card"><div class="card-title">Por local</div>';
  for (var lk in localLbl) { if (porLocal[lk]) html += '<div class="li-sub" style="margin-bottom:6px;">' + localLbl[lk] + ': ' + porLocal[lk] + ' vez(es)</div>'; }
  html += '</div>';
  html += '<div class="card"><div class="card-title">Por cômodo</div>';
  for (var ck in comodoLbl) { if (porComodo[ck]) html += '<div class="li-sub" style="margin-bottom:6px;">' + comodoLbl[ck] + ': ' + porComodo[ck] + ' vez(es)</div>'; }
  html += '</div>';
  return html;
}

function renderListaIntimidade() {
  var arr = window.ST.intimidade.encontros.slice().sort(function (a, b) { return a.data < b.data ? 1 : -1; });
  var html = '';
  if (arr.length === 0) html = '<div class="li-sub">Nenhum registro ainda.</div>';
  var localLabel = { casa: '🏠 Casa', hotel: '🏨 Hotel', casa_familiares: '👨‍👩‍👧 Casa de familiares', outros: '➕ Outros' };
  var comodoLabel = { quarto: '🛏️ Quarto', sala: '🛋️ Sala', banheiro: '🚿 Banheiro', varanda: '🌇 Varanda', outro: '➕ Outro' };
  var inicLabel = { tarcisio: '👨 Tarcísio', aline: '👩 Aline', mutuo: '👫 Mútuo' };
  for (var i = 0; i < arr.length; i++) {
    var reg = arr[i];
    var fase = calcFaseCiclo(reg.data, window.ST.aline.ciclos);
    html += '<div class="list-item"><div>';
    html += '<div class="li-main">' + fmtDate(reg.data) + ' ' + (reg.hora || '') + '</div>';
    html += '<div class="li-sub">' + (inicLabel[reg.iniciativa] || '') + ' · ' + (reg.consumado === 'sim' ? '✅' : '❌') + ' · ' + (localLabel[reg.local] || '') + ' · ' + (comodoLabel[reg.comodo] || '') + (fase ? ' · ' + fase.emoji + ' ' + fase.fase : '') + '</div>';
    if (reg.obs) html += '<div class="discreet-note">' + esc(reg.obs) + '</div>';
    html += '</div><div class="li-actions"><button onclick="editarIntimidade(' + reg.id + ')">✏️</button><button onclick="excluirIntimidade(' + reg.id + ')">🗑</button></div></div>';
  }
  document.getElementById('intimLista').innerHTML = html;
}

function editarIntimidade(id) {
  var arr = window.ST.intimidade.encontros;
  var reg = null;
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { reg = arr[i]; break; }
  if (!reg) return;
  window._sel = {};
  window._sel.intimIniciativa = reg.iniciativa;
  window._sel.intimConsumado = reg.consumado;
  window._sel.intimLocal = reg.local;
  window._sel.intimComodo = reg.comodo;
  window._editId.intimidade = { id: id };
  window._editBuffer.intimidade = { data: reg.data, hora: reg.hora, obs: reg.obs };
  renderIntimidade();
}
window.editarIntimidade = editarIntimidade;

function salvarIntimidade() {
  var iniciativa = window._sel.intimIniciativa;
  var consumado = window._sel.intimConsumado;
  var local = window._sel.intimLocal;
  var comodo = window._sel.intimComodo;
  if (!iniciativa || !consumado || !local || !comodo) { alert('Preencha iniciativa, consumado, local e cômodo'); return; }
  var editando = window._editId.intimidade;
  var reg = {
    id: editando ? editando.id : uid(), data: document.getElementById('intimData').value || hojeISO(),
    hora: document.getElementById('intimHora').value || agoraHora(),
    iniciativa: iniciativa, consumado: consumado, local: local, comodo: comodo,
    obs: document.getElementById('intimObs').value || ''
  };
  if (editando) {
    var arrAntigo = window.ST.intimidade.encontros;
    for (var i = 0; i < arrAntigo.length; i++) if (arrAntigo[i].id === editando.id) { arrAntigo.splice(i, 1); break; }
    window._editId.intimidade = null;
    window._editBuffer.intimidade = null;
  }
  window.ST.intimidade.encontros.push(reg);
  window.saveState();
  window._sel = {};
  renderIntimidade();
}
window.salvarIntimidade = salvarIntimidade;

function excluirIntimidade(id) {
  if (!confirm('Excluir este registro?')) return;
  var arr = window.ST.intimidade.encontros;
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { arr.splice(i, 1); break; }
  window.saveState();
  renderIntimidade();
}
window.excluirIntimidade = excluirIntimidade;

// ===================== SAÚDE =====================
var TIPOS_SAUDE = [
  { v: 'gripe', l: '🤧 Gripe/Resfriado' }, { v: 'dor_cabeca', l: '🤕 Dor de cabeça' },
  { v: 'dor_costas', l: '🦴 Dor nas costas' }, { v: 'virose', l: '🦠 Virose' },
  { v: 'ortopedico', l: '🦴 Ortopédico' }, { v: 'outro', l: '➕ Outro' }
];
function tipoSaudeLabel(v) { for (var i = 0; i < TIPOS_SAUDE.length; i++) if (TIPOS_SAUDE[i].v === v) return TIPOS_SAUDE[i].l; return v; }

var _remediosTemp = [];

function renderSaude() {
  var el = document.getElementById('sec-saude');
  var editando = window._editId.saude;
  var html = '';
  html += '<div class="card"><div class="card-title">🏥 ' + (editando ? 'Editar episódio de saúde' : 'Registrar episódio de saúde') + '</div>';
  html += '<div class="field"><div class="quem-pick">';
  html += '<button type="button" class="quem-btn q-tarcisio' + pillOn('saudeQuem', 'tarcisio') + '" onclick="selectSingle(\'saudeQuem\',\'tarcisio\',this)">👨 Tarcísio</button>';
  html += '<button type="button" class="quem-btn q-aline' + pillOn('saudeQuem', 'aline') + '" onclick="selectSingle(\'saudeQuem\',\'aline\',this)">👩 Aline</button>';
  html += '</div></div>';
  html += '<div class="field"><label>Tipo</label><div class="pill-row">';
  for (var i = 0; i < TIPOS_SAUDE.length; i++) html += '<button type="button" class="tipo-pill' + pillOn('saudeTipo', TIPOS_SAUDE[i].v) + '" onclick="selectSingle(\'saudeTipo\',\'' + TIPOS_SAUDE[i].v + '\',this)">' + TIPOS_SAUDE[i].l + '</button>';
  html += '</div></div>';
  html += '<div class="row2">';
  html += '<div class="field"><label>Início</label><input class="input" type="date" id="saudeInicio" value="' + eb('saude', 'inicio', hojeISO()) + '"></div>';
  html += '<div class="field"><label>Fim (opcional)</label><input class="input" type="date" id="saudeFim" value="' + eb('saude', 'fim') + '"></div>';
  html += '</div>';
  html += '<div class="field"><label>Remédios</label><div id="remediosTempLista"></div>';
  html += '<button type="button" class="btn btn-ghost" onclick="abrirModal(\'modal-remedio\')">+ Adicionar remédio</button></div>';
  html += '<div class="field"><label>Observação (opcional)</label><textarea class="input" id="saudeObs">' + eb('saude', 'obs') + '</textarea></div>';
  html += '<button class="btn btn-primary" onclick="salvarSaude()">' + (editando ? 'Salvar edição' : 'Salvar episódio') + '</button>';
  if (editando) html += ' <button class="btn btn-ghost" onclick="cancelarEdicao(\'saude\')" style="margin-top:8px;">Cancelar edição</button>';
  html += '</div>';
  html += '<div class="card"><div class="card-title">Estatísticas</div>' + renderPeriodoPicker('saude') + '</div>';
  html += renderStatsSaude();
  html += '<div class="card"><div class="card-title">Histórico</div><div id="saudeLista"></div></div>';
  el.innerHTML = html;
  renderRemediosTemp();
  renderListaSaude();
}

function renderRemediosTemp() {
  var html = '';
  for (var i = 0; i < _remediosTemp.length; i++) {
    var r = _remediosTemp[i];
    html += '<div class="li-sub">💊 ' + esc(r.nome) + ' — ' + esc(r.dose) + ' às ' + r.horario + ' (' + r.duracao + ' dias) <button onclick="removerRemedioTemp(' + i + ')" style="border:none;background:none;color:var(--red);">✕</button></div>';
  }
  var elL = document.getElementById('remediosTempLista');
  if (elL) elL.innerHTML = html;
}

function salvarRemedio() {
  var nome = document.getElementById('remNome').value;
  if (!nome) { alert('Preencha o nome do remédio'); return; }
  _remediosTemp.push({
    nome: nome, dose: document.getElementById('remDose').value || '',
    horario: document.getElementById('remHorario').value || '',
    duracao: Number(document.getElementById('remDuracao').value) || 0
  });
  document.getElementById('remNome').value = '';
  document.getElementById('remDose').value = '';
  document.getElementById('remHorario').value = '';
  document.getElementById('remDuracao').value = '';
  fecharModal('modal-remedio');
  renderRemediosTemp();
}
window.salvarRemedio = salvarRemedio;

function removerRemedioTemp(idx) { _remediosTemp.splice(idx, 1); renderRemediosTemp(); }
window.removerRemedioTemp = removerRemedioTemp;

function renderStatsSaude() {
  var doencasTF = filtrarPeriodo(window.ST.tarcisio.doencas, 'inicio', 'saude');
  var doencasAF = filtrarPeriodo(window.ST.aline.doencas, 'inicio', 'saude');
  var html = '<div class="card"><div class="card-title">Resumo do período</div><div class="stat-grid">';
  html += '<div class="stat-box"><div class="num">' + doencasTF.length + '</div><div class="lbl">Episódios — Tarcísio</div></div>';
  html += '<div class="stat-box"><div class="num">' + doencasAF.length + '</div><div class="lbl">Episódios — Aline</div></div>';
  html += '</div></div>';

  var porTipo = {};
  for (var i = 0; i < TIPOS_SAUDE.length; i++) porTipo[TIPOS_SAUDE[i].v] = { tarcisio: 0, aline: 0 };
  for (var j = 0; j < doencasTF.length; j++) { var t1 = doencasTF[j].tipo || 'outro'; if (!porTipo[t1]) porTipo[t1] = { tarcisio: 0, aline: 0 }; porTipo[t1].tarcisio++; }
  for (var k = 0; k < doencasAF.length; k++) { var t2 = doencasAF[k].tipo || 'outro'; if (!porTipo[t2]) porTipo[t2] = { tarcisio: 0, aline: 0 }; porTipo[t2].aline++; }
  html += '<div class="card"><div class="card-title">Por tipo de doença</div><table class="tbl"><tr><th>Tipo</th><th>Tarcísio</th><th>Aline</th></tr>';
  for (var m = 0; m < TIPOS_SAUDE.length; m++) {
    var tv = TIPOS_SAUDE[m].v;
    var c = porTipo[tv];
    if (c.tarcisio === 0 && c.aline === 0) continue;
    html += '<tr><td>' + tipoSaudeLabel(tv) + '</td><td>' + c.tarcisio + '</td><td>' + c.aline + '</td></tr>';
  }
  html += '</table></div>';
  return html;
}

function renderListaSaude() {
  var todos = [];
  for (var i = 0; i < window.ST.tarcisio.doencas.length; i++) { var r = window.ST.tarcisio.doencas[i]; r._quem = 'tarcisio'; todos.push(r); }
  for (var j = 0; j < window.ST.aline.doencas.length; j++) { var r2 = window.ST.aline.doencas[j]; r2._quem = 'aline'; todos.push(r2); }
  todos.sort(function (a, b) { return a.inicio < b.inicio ? 1 : -1; });
  var html = '';
  if (todos.length === 0) html = '<div class="li-sub">Nenhum registro ainda.</div>';
  for (var k = 0; k < todos.length; k++) {
    var reg = todos[k];
    var quemLabel = reg._quem === 'tarcisio' ? '👨 Tarcísio' : '👩 Aline';
    html += '<div class="list-item"><div>';
    html += '<div class="li-main">' + quemLabel + ' — ' + tipoSaudeLabel(reg.tipo) + '</div>';
    html += '<div class="li-sub">' + fmtDate(reg.inicio) + (reg.fim ? ' → ' + fmtDate(reg.fim) : ' (em curso)') + '</div>';
    if (reg.remedios && reg.remedios.length > 0) {
      for (var m = 0; m < reg.remedios.length; m++) {
        html += '<div class="li-sub">💊 ' + esc(reg.remedios[m].nome) + ' — ' + esc(reg.remedios[m].dose) + '</div>';
      }
    }
    if (reg.obs) html += '<div class="li-sub">' + esc(reg.obs) + '</div>';
    html += '</div><div class="li-actions"><button onclick="editarSaude(\'' + reg._quem + '\',' + reg.id + ')">✏️</button><button onclick="excluirSaude(\'' + reg._quem + '\',' + reg.id + ')">🗑</button></div></div>';
  }
  document.getElementById('saudeLista').innerHTML = html;
}

function editarSaude(quem, id) {
  var arr = window.ST[quem].doencas;
  var reg = null;
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { reg = arr[i]; break; }
  if (!reg) return;
  window._sel = {};
  window._sel.saudeQuem = quem;
  window._sel.saudeTipo = reg.tipo;
  window._editId.saude = { quem: quem, id: id };
  window._editBuffer.saude = { inicio: reg.inicio, fim: reg.fim, obs: reg.obs };
  _remediosTemp = (reg.remedios || []).slice();
  renderSaude();
}
window.editarSaude = editarSaude;

function salvarSaude() {
  var quem = window._sel.saudeQuem;
  var tipo = window._sel.saudeTipo;
  if (!quem || !tipo) { alert('Selecione quem e o tipo'); return; }
  var editando = window._editId.saude;
  var reg = {
    id: editando ? editando.id : uid(), tipo: tipo,
    inicio: document.getElementById('saudeInicio').value || hojeISO(),
    fim: document.getElementById('saudeFim').value || null,
    remedios: _remediosTemp.slice(),
    obs: document.getElementById('saudeObs').value || '', registradoPor: window._userName || null
  };
  if (editando) {
    var arrAntigo = window.ST[editando.quem].doencas;
    for (var i = 0; i < arrAntigo.length; i++) if (arrAntigo[i].id === editando.id) { arrAntigo.splice(i, 1); break; }
    window._editId.saude = null;
    window._editBuffer.saude = null;
  }
  window.ST[quem].doencas.push(reg);
  window.saveState();
  _remediosTemp = [];
  window._sel = {};
  renderSaude();
}
window.salvarSaude = salvarSaude;

function excluirSaude(quem, id) {
  if (!confirm('Excluir este episódio?')) return;
  var arr = window.ST[quem].doencas;
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { arr.splice(i, 1); break; }
  window.saveState();
  renderSaude();
}
window.excluirSaude = excluirSaude;

// ===================== CICLO MENSTRUAL =====================
var FASE_COR = { 'Menstruação': '#FECDD3', 'Folicular': '#D1FAE5', 'Fértil': '#FEF9C3', 'Lútea': '#DCC7F5', 'TPM': '#FFCC99' };
var SINTOMAS_CICLO = ['Cólica', 'TPM', 'Humor baixo', 'Cansaço', 'Energia alta'];

window._cicloMesOffset = 0;
function navCicloMes(delta) {
  window._cicloMesOffset += delta;
  renderCiclo();
}
window.navCicloMes = navCicloMes;
function irParaMesAtualCiclo() {
  window._cicloMesOffset = 0;
  renderCiclo();
}
window.irParaMesAtualCiclo = irParaMesAtualCiclo;

function renderCiclo() {
  var el = document.getElementById('sec-ciclo');
  var editando = window._editId.ciclo;
  var html = '';
  html += '<div class="card"><div class="card-title">🌸 ' + (editando ? 'Editar ciclo' : 'Registrar novo ciclo') + '</div>';
  html += '<div class="card-sub">Registre o início assim que a menstruação começar. Quando ela terminar, edite o mesmo registro e preencha o término.</div>';
  html += '<div class="field"><label>Início da menstruação</label><input class="input" type="date" id="cicloData" value="' + eb('ciclo', 'dataInicio', hojeISO()) + '"></div>';
  html += '<div class="field"><label>Término da menstruação (opcional)</label><input class="input" type="date" id="cicloDataFim" value="' + eb('ciclo', 'dataFim') + '"></div>';
  html += '<div class="field"><label>Sintomas (opcional)</label><div class="pill-row">';
  for (var i = 0; i < SINTOMAS_CICLO.length; i++) html += '<button type="button" class="tipo-pill' + pillMultiOn('cicloSintomas', SINTOMAS_CICLO[i]) + '" onclick="selectMulti(\'cicloSintomas\',\'' + SINTOMAS_CICLO[i] + '\',this)">' + SINTOMAS_CICLO[i] + '</button>';
  html += '</div></div>';
  html += '<button class="btn btn-primary" onclick="salvarCiclo()">' + (editando ? 'Salvar edição' : 'Salvar ciclo') + '</button>';
  if (editando) html += ' <button class="btn btn-ghost" onclick="cancelarEdicao(\'ciclo\')" style="margin-top:8px;">Cancelar edição</button>';
  html += '</div>';

  var fase = calcFaseCiclo(hojeISO(), window.ST.aline.ciclos);
  if (fase) {
    html += '<div class="card"><div class="card-title">Fase atual: ' + fase.emoji + ' ' + fase.fase + '</div>';
    html += '<div class="card-sub">Dia ' + fase.dia + ' de ' + fase.duracao + (fase.duracaoEstimada ? ' (estimado)' : '') + '</div>';
    html += renderCalendarioCiclo();
    html += '</div>';
  }

  html += renderEstimativasCiclo();
  html += '<div class="card"><div class="card-title">Histórico de ciclos</div><div id="cicloLista"></div></div>';
  el.innerHTML = html;
  renderListaCiclo();
}

function renderEstimativasCiclo() {
  var ciclos = window.ST.aline.ciclos;
  if (ciclos.length === 0) return '';
  var duracaoMedia = estimarDuracaoMedia(ciclos);
  var menstruacaoMedia = estimarDuracaoMenstruacao(ciclos);
  var ord = ciclosOrdenados(ciclos);
  var completos = ord.length - 1;
  var ultimo = ord[ord.length - 1];
  var previsao = addDias(ultimo.dataInicio, duracaoMedia);
  var html = '<div class="card"><div class="card-title">📈 Estimativas (baseado no histórico)</div>';
  html += '<div class="stat-grid">';
  html += '<div class="stat-box"><div class="num">' + duracaoMedia + 'd</div><div class="lbl">Duração média do ciclo' + (completos > 0 ? ' (' + completos + ' completo' + (completos > 1 ? 's' : '') + ')' : ' (padrão)') + '</div></div>';
  html += '<div class="stat-box"><div class="num">' + menstruacaoMedia + 'd</div><div class="lbl">Duração média da menstruação</div></div>';
  html += '</div>';
  html += '<div class="li-sub" style="margin-top:10px;">🔮 Próxima menstruação prevista: <b>' + fmtDate(previsao) + '</b></div>';
  html += '</div>';
  return html;
}

function renderCalendarioCiclo() {
  var base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + window._cicloMesOffset);
  var ano = base.getFullYear(), mesIdx = base.getMonth();
  var nomesMes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var primeiroDia = new Date(ano, mesIdx, 1).getDay();
  var totalDias = new Date(ano, mesIdx + 1, 0).getDate();

  var ciclos = window.ST.aline.ciclos;
  var iniciosPorData = {}, fimsPorData = {};
  for (var c = 0; c < ciclos.length; c++) {
    iniciosPorData[ciclos[c].dataInicio] = true;
    if (ciclos[c].dataFim) fimsPorData[ciclos[c].dataFim] = true;
  }
  var intimidadePorData = {};
  var encontros = window.ST.intimidade.encontros;
  for (var e = 0; e < encontros.length; e++) {
    if (encontros[e].consumado === 'sim') intimidadePorData[encontros[e].data] = true;
  }

  var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">';
  html += '<button type="button" class="btn btn-ghost" style="padding:6px 12px;" onclick="navCicloMes(-1)">← </button>';
  html += '<div style="font-weight:700;color:var(--txt);">' + nomesMes[mesIdx] + ' de ' + ano + '</div>';
  html += '<button type="button" class="btn btn-ghost" style="padding:6px 12px;" onclick="navCicloMes(1)"> →</button>';
  html += '</div>';
  if (window._cicloMesOffset !== 0) html += '<div style="text-align:center;margin-bottom:8px;"><button type="button" class="btn btn-ghost" style="padding:4px 10px;font-size:11px;" onclick="irParaMesAtualCiclo()">Voltar para hoje</button></div>';
  html += '<div class="cal-grid" style="margin-top:0;">';
  for (var w = 0; w < 7; w++) html += '<div style="text-align:center;font-size:11px;font-weight:700;color:var(--muted);">' + diasSemana[w] + '</div>';
  for (var i = 0; i < primeiroDia; i++) html += '<div></div>';
  for (var d = 1; d <= totalDias; d++) {
    var iso = ano + '-' + pad2(mesIdx + 1) + '-' + pad2(d);
    var f = calcFaseCiclo(iso, ciclos);
    var cor = f ? FASE_COR[f.fase] : '#eee';
    var isToday = iso === hojeISO();
    var marcadores = '';
    if (iniciosPorData[iso]) marcadores += '🩸';
    if (fimsPorData[iso]) marcadores += '🏁';
    if (intimidadePorData[iso]) marcadores += '❤️';
    html += '<div class="cal-day' + (isToday ? ' today' : '') + '" style="background:' + cor + ';flex-direction:column;gap:0;line-height:1.1;">';
    html += '<div>' + d + '</div>';
    if (marcadores) html += '<div style="font-size:8px;">' + marcadores + '</div>';
    html += '</div>';
  }
  html += '</div>';
  html += '<div class="legend">';
  html += '<span><i style="background:#FECDD3;"></i>Menstruação</span>';
  html += '<span><i style="background:#D1FAE5;"></i>Folicular</span>';
  html += '<span><i style="background:#FEF9C3;"></i>Fértil</span>';
  html += '<span><i style="background:#DCC7F5;"></i>Lútea</span>';
  html += '<span><i style="background:#FFCC99;"></i>TPM</span>';
  html += '</div>';
  html += '<div class="legend" style="margin-top:4px;">';
  html += '<span>🩸 Início da menstruação</span>';
  html += '<span>🏁 Término da menstruação</span>';
  html += '<span>❤️ Intimidade consumada</span>';
  html += '</div>';
  return html;
}

function renderListaCiclo() {
  var arr = window.ST.aline.ciclos.slice().sort(function (a, b) { return a.dataInicio < b.dataInicio ? 1 : -1; });
  var html = '';
  if (arr.length === 0) html = '<div class="li-sub">Nenhum ciclo registrado.</div>';
  for (var i = 0; i < arr.length; i++) {
    var reg = arr[i];
    var info = infoCiclo(reg, window.ST.aline.ciclos);
    html += '<div class="list-item"><div>';
    html += '<div class="li-main">🩸 Início: ' + fmtDate(reg.dataInicio) + (reg.dataFim ? ' · 🏁 Término: ' + fmtDate(reg.dataFim) : ' · menstruação em andamento') + '</div>';
    html += '<div class="li-sub">Duração do ciclo: ' + info.duracaoReal + ' dias' + (info.estimado ? ' (estimado)' : '') + '</div>';
    if (reg.sintomas && reg.sintomas.length > 0) html += '<div class="li-sub">' + reg.sintomas.join(', ') + '</div>';
    html += '</div></div>';
    html += '<div class="li-actions"><button onclick="editarCiclo(' + reg.id + ')">✏️</button><button onclick="excluirCiclo(' + reg.id + ')">🗑</button></div></div>';
  }
  document.getElementById('cicloLista').innerHTML = html;
}

function editarCiclo(id) {
  var arr = window.ST.aline.ciclos;
  var reg = null;
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { reg = arr[i]; break; }
  if (!reg) return;
  window._sel = {};
  window._sel.cicloSintomas = (reg.sintomas || []).slice();
  window._editId.ciclo = { id: id };
  window._editBuffer.ciclo = { dataInicio: reg.dataInicio, dataFim: reg.dataFim };
  renderCiclo();
}
window.editarCiclo = editarCiclo;

function salvarCiclo() {
  var data = document.getElementById('cicloData').value;
  if (!data) { alert('Preencha a data em que a menstruação começou'); return; }
  var dataFim = document.getElementById('cicloDataFim').value || null;
  if (dataFim && dataFim < data) { alert('A data de término não pode ser antes do início'); return; }
  var editando = window._editId.ciclo;
  var reg = {
    id: editando ? editando.id : uid(), dataInicio: data, dataFim: dataFim,
    sintomas: window._sel.cicloSintomas || []
  };
  if (editando) {
    var arrAntigo = window.ST.aline.ciclos;
    for (var i = 0; i < arrAntigo.length; i++) if (arrAntigo[i].id === editando.id) { arrAntigo.splice(i, 1); break; }
    window._editId.ciclo = null;
    window._editBuffer.ciclo = null;
  }
  window.ST.aline.ciclos.push(reg);
  window.saveState();
  window._sel = {};
  renderCiclo();
}
window.salvarCiclo = salvarCiclo;

function excluirCiclo(id) {
  if (!confirm('Excluir este ciclo?')) return;
  var arr = window.ST.aline.ciclos;
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { arr.splice(i, 1); break; }
  window.saveState();
  renderCiclo();
}
window.excluirCiclo = excluirCiclo;

// ===================== ÁLCOOL =====================
var TIPOS_BEBIDA = [
  { v: 'cerveja', l: '🍺 Cerveja' }, { v: 'vinho', l: '🍷 Vinho' },
  { v: 'espumante', l: '🥂 Espumante' }, { v: 'drink', l: '🍹 Drink' },
  { v: 'whisky', l: '🥃 Whisky' }, { v: 'vodka', l: '🍸 Vodka' },
  { v: 'ice', l: '🧊 Ice' }, { v: 'cachaca', l: '🍶 Cachaça' },
  { v: 'caipirinha', l: '🍈 Caipirinha' }, { v: 'outro', l: '🫧 Outro' }
];
function tipoBebidaLabel(v) { for (var i = 0; i < TIPOS_BEBIDA.length; i++) if (TIPOS_BEBIDA[i].v === v) return TIPOS_BEBIDA[i].l; return v; }

function renderAlcool() {
  var el = document.getElementById('sec-alcool');
  var editando = window._editId.alcool;
  var html = '';
  html += '<div class="card"><div class="card-title">🍺 ' + (editando ? 'Editar registro' : 'Registrar consumo') + '</div>';
  html += '<div class="field"><div class="quem-pick">';
  html += '<button type="button" class="quem-btn q-tarcisio' + pillOn('alcoolQuem', 'tarcisio') + '" onclick="selectSingle(\'alcoolQuem\',\'tarcisio\',this)">👨 Tarcísio</button>';
  html += '<button type="button" class="quem-btn q-aline' + pillOn('alcoolQuem', 'aline') + '" onclick="selectSingle(\'alcoolQuem\',\'aline\',this)">👩 Aline</button>';
  html += '<button type="button" class="quem-btn q-juntos' + pillOn('alcoolQuem', 'juntos') + '" onclick="selectSingle(\'alcoolQuem\',\'juntos\',this)">👫 Juntos</button>';
  html += '</div></div>';
  html += '<div class="field"><label>Bebida</label><div class="pill-row">';
  for (var i = 0; i < TIPOS_BEBIDA.length; i++) html += '<button type="button" class="tipo-pill' + pillOn('alcoolBebida', TIPOS_BEBIDA[i].v) + '" onclick="selectSingle(\'alcoolBebida\',\'' + TIPOS_BEBIDA[i].v + '\',this)">' + TIPOS_BEBIDA[i].l + '</button>';
  html += '</div></div>';
  html += '<div class="row2">';
  html += '<div class="field"><label>Quantidade</label><input class="input" type="number" id="alcoolQtd" value="' + eb('alcool', 'quantidade') + '"></div>';
  html += '<div class="field"><label>Unidade</label><div class="pill-row">';
  html += '<button type="button" class="tipo-pill' + pillOn('alcoolUnidade', 'doses') + '" onclick="selectSingle(\'alcoolUnidade\',\'doses\',this)">doses</button>';
  html += '<button type="button" class="tipo-pill' + pillOn('alcoolUnidade', 'tacas') + '" onclick="selectSingle(\'alcoolUnidade\',\'tacas\',this)">taças</button>';
  html += '<button type="button" class="tipo-pill' + pillOn('alcoolUnidade', 'latas') + '" onclick="selectSingle(\'alcoolUnidade\',\'latas\',this)">latas</button>';
  html += '<button type="button" class="tipo-pill' + pillOn('alcoolUnidade', 'garrafas') + '" onclick="selectSingle(\'alcoolUnidade\',\'garrafas\',this)">garrafas</button>';
  html += '</div></div></div>';
  html += '<div class="field"><label>Acompanhamento</label><div class="pill-row">';
  html += '<button type="button" class="tipo-pill' + pillMultiOn('alcoolAcomp', 'energetico') + '" onclick="selectMulti(\'alcoolAcomp\',\'energetico\',this)">Energético</button>';
  html += '<button type="button" class="tipo-pill' + pillMultiOn('alcoolAcomp', 'refrigerante') + '" onclick="selectMulti(\'alcoolAcomp\',\'refrigerante\',this)">Refrigerante</button>';
  html += '<button type="button" class="tipo-pill' + pillMultiOn('alcoolAcomp', 'suco') + '" onclick="selectMulti(\'alcoolAcomp\',\'suco\',this)">Suco</button>';
  html += '<button type="button" class="tipo-pill' + pillMultiOn('alcoolAcomp', 'puro') + '" onclick="selectMulti(\'alcoolAcomp\',\'puro\',this)">Puro</button>';
  html += '</div></div>';
  html += '<div class="row2">';
  html += '<div class="field"><label>Data</label><input class="input" type="date" id="alcoolData" value="' + eb('alcool', 'data', hojeISO()) + '"></div>';
  html += '<div class="field"><label>Horário</label><input class="input" type="time" id="alcoolHora" value="' + eb('alcool', 'hora', agoraHora()) + '"></div>';
  html += '</div>';
  html += '<div class="field"><label>Contexto (opcional)</label><input class="input" id="alcoolContexto" placeholder="Onde foi, ocasião" value="' + eb('alcool', 'contexto') + '"></div>';
  html += '<button class="btn btn-primary" onclick="salvarAlcool()">' + (editando ? 'Salvar edição' : 'Salvar registro') + '</button>';
  if (editando) html += ' <button class="btn btn-ghost" onclick="cancelarEdicao(\'alcool\')" style="margin-top:8px;">Cancelar edição</button>';
  html += '</div>';
  html += '<div class="card"><div class="card-title">Estatísticas</div>' + renderPeriodoPicker('alcool') + '</div>';
  html += renderStatsAlcool();
  html += '<div class="card"><div class="card-title">Histórico</div><div id="alcoolLista"></div></div>';
  el.innerHTML = html;
  renderListaAlcool();
}

function renderStatsAlcool() {
  var alcoolTF = filtrarPeriodo(window.ST.tarcisio.alcool, 'data', 'alcool');
  var alcoolAF = filtrarPeriodo(window.ST.aline.alcool, 'data', 'alcool');
  var html = '<div class="card"><div class="card-title">Resumo do período</div><div class="stat-grid">';
  html += '<div class="stat-box"><div class="num">' + alcoolTF.length + '</div><div class="lbl">Registros — Tarcísio</div></div>';
  html += '<div class="stat-box"><div class="num">' + alcoolAF.length + '</div><div class="lbl">Registros — Aline</div></div>';
  html += '</div></div>';

  var porTipo = {};
  for (var i = 0; i < TIPOS_BEBIDA.length; i++) porTipo[TIPOS_BEBIDA[i].v] = { contagem: 0, quantidade: 0 };
  var todos = alcoolTF.concat(alcoolAF);
  for (var j = 0; j < todos.length; j++) {
    var tv = todos[j].bebida || 'outro';
    if (!porTipo[tv]) porTipo[tv] = { contagem: 0, quantidade: 0 };
    porTipo[tv].contagem++;
    porTipo[tv].quantidade += (todos[j].quantidade || 0);
  }
  html += '<div class="card"><div class="card-title">Por tipo de bebida</div><table class="tbl"><tr><th>Bebida</th><th>Registros</th><th>Quantidade total</th></tr>';
  for (var k = 0; k < TIPOS_BEBIDA.length; k++) {
    var tv2 = TIPOS_BEBIDA[k].v;
    var c = porTipo[tv2];
    if (c.contagem === 0) continue;
    html += '<tr><td>' + tipoBebidaLabel(tv2) + '</td><td>' + c.contagem + '</td><td>' + c.quantidade + '</td></tr>';
  }
  html += '</table></div>';
  return html;
}

function renderListaAlcool() {
  var todos = [];
  for (var i = 0; i < window.ST.tarcisio.alcool.length; i++) { var r = window.ST.tarcisio.alcool[i]; r._quem = 'tarcisio'; todos.push(r); }
  for (var j = 0; j < window.ST.aline.alcool.length; j++) { var r2 = window.ST.aline.alcool[j]; r2._quem = 'aline'; todos.push(r2); }
  todos.sort(function (a, b) { return a.data < b.data ? 1 : -1; });
  var html = '';
  if (todos.length === 0) html = '<div class="li-sub">Nenhum registro ainda.</div>';
  var quemLabelMap = { tarcisio: '👨 Tarcísio', aline: '👩 Aline', juntos: '👫 Juntos' };
  for (var k = 0; k < todos.length; k++) {
    var reg = todos[k];
    html += '<div class="list-item"><div>';
    html += '<div class="li-main">' + (quemLabelMap[reg._quem] || quemLabelMap[reg.quem]) + ' — ' + tipoBebidaLabel(reg.bebida) + '</div>';
    html += '<div class="li-sub">' + fmtDate(reg.data) + ' · ' + (reg.quantidade || '') + ' ' + (reg.unidade || '') + '</div>';
    if (reg.contexto) html += '<div class="li-sub">' + esc(reg.contexto) + '</div>';
    html += '</div><div class="li-actions"><button onclick="editarAlcool(\'' + reg._quem + '\',' + reg.id + ')">✏️</button><button onclick="excluirAlcool(\'' + reg._quem + '\',' + reg.id + ')">🗑</button></div></div>';
  }
  document.getElementById('alcoolLista').innerHTML = html;
}

function editarAlcool(quemArmazenado, id) {
  var arr = window.ST[quemArmazenado].alcool;
  var reg = null;
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { reg = arr[i]; break; }
  if (!reg) return;
  window._sel = {};
  window._sel.alcoolQuem = reg.quem || quemArmazenado;
  window._sel.alcoolBebida = reg.bebida;
  window._sel.alcoolUnidade = reg.unidade;
  window._sel.alcoolAcomp = (reg.acompanhamento || []).slice();
  window._editId.alcool = { quem: quemArmazenado, id: id };
  window._editBuffer.alcool = { data: reg.data, hora: reg.hora, quantidade: reg.quantidade, contexto: reg.contexto };
  renderAlcool();
}
window.editarAlcool = editarAlcool;

function salvarAlcool() {
  var quem = window._sel.alcoolQuem;
  var bebida = window._sel.alcoolBebida;
  if (!quem || !bebida) { alert('Selecione quem e a bebida'); return; }
  var editando = window._editId.alcool;
  var reg = {
    id: editando ? editando.id : uid(), data: document.getElementById('alcoolData').value || hojeISO(),
    hora: document.getElementById('alcoolHora').value || agoraHora(),
    bebida: bebida, quantidade: Number(document.getElementById('alcoolQtd').value) || 0,
    unidade: window._sel.alcoolUnidade || 'doses', acompanhamento: window._sel.alcoolAcomp || [],
    contexto: document.getElementById('alcoolContexto').value || '', registradoPor: window._userName || null
  };
  var alvo = quem === 'juntos' ? 'tarcisio' : quem;
  reg.quem = quem;
  if (editando) {
    var arrAntigo = window.ST[editando.quem].alcool;
    for (var i = 0; i < arrAntigo.length; i++) if (arrAntigo[i].id === editando.id) { arrAntigo.splice(i, 1); break; }
    window._editId.alcool = null;
    window._editBuffer.alcool = null;
  }
  window.ST[alvo].alcool.push(reg);
  window.saveState();
  window._sel = {};
  renderAlcool();
}
window.salvarAlcool = salvarAlcool;

function excluirAlcool(quemArmazenado, id) {
  if (!confirm('Excluir este registro?')) return;
  var arr = window.ST[quemArmazenado].alcool;
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { arr.splice(i, 1); break; }
  window.saveState();
  renderAlcool();
}
window.excluirAlcool = excluirAlcool;

// ===================== COMPARATIVO =====================
window._periodoAtivo = 'mes';
function setPeriodo(p, el) {
  window._periodoAtivo = p;
  var btns = el.parentElement.children;
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('on');
  el.classList.add('on');
  renderComparativo();
}
window.setPeriodo = setPeriodo;

function dataDentroPeriodo(iso) {
  var p = window._periodoAtivo;
  if (p === 'tudo') return true;
  var hoje = hojeISO();
  if (p === 'semana') return diffDias(iso, hoje) <= 7 && diffDias(iso, hoje) >= 0;
  if (p === 'mes') return diffDias(iso, hoje) <= 31 && diffDias(iso, hoje) >= 0;
  return true;
}

function filtrar(arr, campoData) {
  var out = [];
  for (var i = 0; i < arr.length; i++) if (dataDentroPeriodo(arr[i][campoData])) out.push(arr[i]);
  return out;
}

function renderComparativo() {
  var el = document.getElementById('sec-comparativo');
  var html = '';
  html += '<div class="period-pick">';
  html += '<button class="on" onclick="setPeriodo(\'semana\',this)">Semana</button>';
  html += '<button onclick="setPeriodo(\'mes\',this)">Mês</button>';
  html += '<button onclick="setPeriodo(\'tudo\',this)">Tudo</button>';
  html += '</div>';

  var sonoT = filtrar(window.ST.tarcisio.sono, 'data');
  var sonoA = filtrar(window.ST.aline.sono, 'data');
  var treinoT = filtrar(window.ST.tarcisio.treinos, 'data');
  var treinoA = filtrar(window.ST.aline.treinos, 'data');
  var saudeT = filtrar(window.ST.tarcisio.doencas, 'inicio');
  var saudeA = filtrar(window.ST.aline.doencas, 'inicio');
  var alcoolT = filtrar(window.ST.tarcisio.alcool, 'data');
  var alcoolA = filtrar(window.ST.aline.alcool, 'data');

  var durT = [], durA = [];
  for (var i = 0; i < sonoT.length; i++) { var d = calcSonoReal(sonoT[i].dormir, sonoT[i].acordar, sonoT[i].intervalo); if (d) durT.push(d); }
  for (var j = 0; j < sonoA.length; j++) { var d2 = calcSonoReal(sonoA[j].dormir, sonoA[j].acordar, sonoA[j].intervalo); if (d2) durA.push(d2); }

  html += '<div class="card"><div class="card-title">😴 Sono</div><div class="stat-grid">';
  html += '<div class="stat-box"><div class="num">' + minParaHoras(media(durT)) + '</div><div class="lbl">Tarcísio</div></div>';
  html += '<div class="stat-box"><div class="num">' + minParaHoras(media(durA)) + '</div><div class="lbl">Aline</div></div>';
  html += '</div></div>';

  html += '<div class="card"><div class="card-title">🏃 Atividade física</div><div class="stat-grid">';
  html += '<div class="stat-box"><div class="num">' + treinoT.length + '</div><div class="lbl">Treinos Tarcísio</div></div>';
  html += '<div class="stat-box"><div class="num">' + treinoA.length + '</div><div class="lbl">Treinos Aline</div></div>';
  html += '</div></div>';

  html += '<div class="card"><div class="card-title">🏥 Saúde</div><div class="stat-grid">';
  html += '<div class="stat-box"><div class="num">' + saudeT.length + '</div><div class="lbl">Episódios Tarcísio</div></div>';
  html += '<div class="stat-box"><div class="num">' + saudeA.length + '</div><div class="lbl">Episódios Aline</div></div>';
  html += '</div></div>';

  html += '<div class="card"><div class="card-title">🍺 Álcool</div><div class="stat-grid">';
  html += '<div class="stat-box"><div class="num">' + alcoolT.length + '</div><div class="lbl">Tarcísio</div></div>';
  html += '<div class="stat-box"><div class="num">' + alcoolA.length + '</div><div class="lbl">Aline</div></div>';
  html += '</div></div>';

  html += renderEvolucaoMensal();
  el.innerHTML = html;
}

function chaveMs(iso) { var p = iso.split('-'); return p[0] + '-' + p[1]; }

function renderEvolucaoMensal() {
  var meses = {};
  function reg(iso, campo, quem, valor) {
    var k = chaveMs(iso);
    if (!meses[k]) meses[k] = { tarcisio: {}, aline: {} };
    meses[k][quem][campo] = meses[k][quem][campo] || [];
    meses[k][quem][campo].push(valor);
  }
  for (var i = 0; i < window.ST.tarcisio.sono.length; i++) { var r = window.ST.tarcisio.sono[i]; var d = calcSonoReal(r.dormir, r.acordar, r.intervalo); if (d) reg(r.data, 'sono', 'tarcisio', d); }
  for (var j = 0; j < window.ST.aline.sono.length; j++) { var r2 = window.ST.aline.sono[j]; var d2 = calcSonoReal(r2.dormir, r2.acordar, r2.intervalo); if (d2) reg(r2.data, 'sono', 'aline', d2); }
  for (var k = 0; k < window.ST.tarcisio.treinos.length; k++) reg(window.ST.tarcisio.treinos[k].data, 'treino', 'tarcisio', 1);
  for (var l = 0; l < window.ST.aline.treinos.length; l++) reg(window.ST.aline.treinos[l].data, 'treino', 'aline', 1);
  for (var m = 0; m < window.ST.tarcisio.doencas.length; m++) reg(window.ST.tarcisio.doencas[m].inicio, 'saude', 'tarcisio', 1);
  for (var n = 0; n < window.ST.aline.doencas.length; n++) reg(window.ST.aline.doencas[n].inicio, 'saude', 'aline', 1);

  var chaves = Object.keys(meses).sort();
  var html = '<div class="card"><div class="card-title">Evolução mês a mês</div>';
  html += '<table class="tbl"><tr><th>Mês</th><th>Sono T</th><th>Sono A</th><th>Treinos T</th><th>Treinos A</th><th>Saúde T</th><th>Saúde A</th></tr>';
  for (var o = 0; o < chaves.length; o++) {
    var ch = chaves[o];
    var mm = meses[ch];
    var sT = mm.tarcisio.sono ? minParaHoras(media(mm.tarcisio.sono)) : '—';
    var sA = mm.aline.sono ? minParaHoras(media(mm.aline.sono)) : '—';
    var tT = mm.tarcisio.treino ? mm.tarcisio.treino.length : 0;
    var tA = mm.aline.treino ? mm.aline.treino.length : 0;
    var hT = mm.tarcisio.saude ? mm.tarcisio.saude.length : 0;
    var hA = mm.aline.saude ? mm.aline.saude.length : 0;
    html += '<tr><td>' + ch + '</td><td>' + sT + '</td><td>' + sA + '</td><td>' + tT + '</td><td>' + tA + '</td><td>' + hT + '</td><td>' + hA + '</td></tr>';
  }
  html += '</table></div>';
  return html;
}

// ===================== INSIGHTS (correlações fixas) =====================
function sonoUnificado() {
  var out = [];
  for (var i = 0; i < window.ST.tarcisio.sono.length; i++) {
    var r = window.ST.tarcisio.sono[i];
    out.push({ quem: 'tarcisio', data: r.data, dormir: r.dormir, min: calcSonoReal(r.dormir, r.acordar, r.intervalo), desp: r.despertares || 0 });
  }
  for (var j = 0; j < window.ST.aline.sono.length; j++) {
    var r2 = window.ST.aline.sono[j];
    out.push({ quem: 'aline', data: r2.data, dormir: r2.dormir, min: calcSonoReal(r2.dormir, r2.acordar, r2.intervalo), desp: r2.despertares || 0 });
  }
  return out;
}

function bucketFaixaHorario(hhmm) {
  var m = horaParaMin(hhmm);
  if (m === null) return null;
  if (m < 22 * 60 && m >= 12 * 60) return 'Antes das 22h';
  if (m >= 22 * 60 && m < 23 * 60) return '22h–23h';
  if (m >= 23 * 60 && m < 24 * 60) return '23h–00h';
  return 'Depois da meia-noite';
}

function treinoNoDia(quem, data) {
  var arr = window.ST[quem].treinos.concat(window.ST.tarcisio.treinos.filter === undefined ? [] : []);
  var lista = window.ST[quem].treinos;
  var achou = null;
  for (var i = 0; i < lista.length; i++) if (lista[i].data === data) achou = lista[i];
  if (!achou) return 'Sem treino';
  if (achou.intensidade === 'leve') return 'Treino leve';
  if (achou.intensidade === 'intensa') return 'Treino intenso';
  return 'Treino moderado';
}

function alcoolDiaAnterior(quem, data) {
  var alvo = quem === 'juntos' ? 'tarcisio' : quem;
  var lista = window.ST[alvo].alcool;
  var d = new Date(data + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  var iso = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  var total = 0;
  for (var i = 0; i < lista.length; i++) if (lista[i].data === iso) total += (lista[i].quantidade || 0);
  if (total === 0) return 'Sem álcool';
  if (total <= 2) return 'Pouco (1–2)';
  if (total <= 4) return 'Moderado (3–4)';
  return 'Muito (5+)';
}

function saudeNoDia(quem, data) {
  var lista = window.ST[quem].doencas;
  for (var i = 0; i < lista.length; i++) {
    var r = lista[i];
    var fimOk = r.fim ? data <= r.fim : true;
    if (data >= r.inicio && fimOk) return 'Doente';
  }
  return 'Saudável';
}

function tabelaFaixas(titulo, ordem, mapaFaixa) {
  var html = '<div class="card"><div class="card-title">' + titulo + '</div>';
  html += '<table class="tbl"><tr><th>Faixa</th><th>Sono médio</th><th>Despertares</th><th>n</th></tr>';
  var medias = [];
  for (var i = 0; i < ordem.length; i++) {
    var f = ordem[i];
    var dados = mapaFaixa[f] || [];
    var mins = [], desps = [];
    for (var j = 0; j < dados.length; j++) { if (dados[j].min) mins.push(dados[j].min); desps.push(dados[j].desp); }
    medias.push({ faixa: f, sono: media(mins), n: dados.length });
  }
  var melhor = null, pior = null;
  for (var k = 0; k < medias.length; k++) {
    if (medias[k].sono === null) continue;
    if (melhor === null || medias[k].sono > medias[melhor].sono) melhor = k;
    if (pior === null || medias[k].sono < medias[pior].sono) pior = k;
  }
  for (var m = 0; m < ordem.length; m++) {
    var f2 = ordem[m];
    var dados2 = mapaFaixa[f2] || [];
    var mins2 = [], desps2 = [];
    for (var n = 0; n < dados2.length; n++) { if (dados2[n].min) mins2.push(dados2[n].min); desps2.push(dados2[n].desp); }
    var classe = m === melhor ? 'best' : (m === pior ? 'worst' : '');
    html += '<tr><td>' + f2 + '</td><td class="' + classe + '">' + minParaHoras(media(mins2)) + '</td><td>' + fmt1(media(desps2)) + '</td><td>' + dados2.length + '</td></tr>';
  }
  html += '</table></div>';
  return html;
}

function renderInsights() {
  var el = document.getElementById('sec-insights');
  var sonos = sonoUnificado();
  var html = '';

  // Bloco 1: horário de dormir
  var b1 = {}; var ordem1 = ['Antes das 22h', '22h–23h', '23h–00h', 'Depois da meia-noite'];
  for (var i = 0; i < ordem1.length; i++) b1[ordem1[i]] = [];
  for (var s = 0; s < sonos.length; s++) { var f = bucketFaixaHorario(sonos[s].dormir); if (f) b1[f].push(sonos[s]); }
  html += tabelaFaixas('Bloco 1 — Horário de dormir vs sono', ordem1, b1);

  // Bloco 2: treino no dia
  var b2 = {}; var ordem2 = ['Sem treino', 'Treino leve', 'Treino moderado', 'Treino intenso'];
  for (var j = 0; j < ordem2.length; j++) b2[ordem2[j]] = [];
  for (var s2 = 0; s2 < sonos.length; s2++) { var f2 = treinoNoDia(sonos[s2].quem, sonos[s2].data); b2[f2].push(sonos[s2]); }
  html += tabelaFaixas('Bloco 2 — Treino no dia vs sono', ordem2, b2);

  // Bloco 3: álcool dia anterior
  var b3 = {}; var ordem3 = ['Sem álcool', 'Pouco (1–2)', 'Moderado (3–4)', 'Muito (5+)'];
  for (var k = 0; k < ordem3.length; k++) b3[ordem3[k]] = [];
  for (var s3 = 0; s3 < sonos.length; s3++) { var f3 = alcoolDiaAnterior(sonos[s3].quem, sonos[s3].data); b3[f3].push(sonos[s3]); }
  html += tabelaFaixas('Bloco 3 — Álcool no dia anterior vs sono', ordem3, b3);

  // Bloco 4: saúde
  var b4 = {}; var ordem4 = ['Saudável', 'Doente'];
  for (var l = 0; l < ordem4.length; l++) b4[ordem4[l]] = [];
  for (var s4 = 0; s4 < sonos.length; s4++) { var f4 = saudeNoDia(sonos[s4].quem, sonos[s4].data); b4[f4].push(sonos[s4]); }
  html += tabelaFaixas('Bloco 4 — Saúde vs sono', ordem4, b4);

  // Bloco 5: fase do ciclo vs sono da Aline
  var b5 = {}; var ordem5 = ['Menstruação', 'Folicular', 'Fértil', 'Lútea', 'TPM'];
  for (var m2 = 0; m2 < ordem5.length; m2++) b5[ordem5[m2]] = [];
  for (var s5 = 0; s5 < sonos.length; s5++) {
    if (sonos[s5].quem !== 'aline') continue;
    var fase5 = calcFaseCiclo(sonos[s5].data, window.ST.aline.ciclos);
    if (fase5) b5[fase5.fase].push(sonos[s5]);
  }
  html += tabelaFaixas('Bloco 5 — Fase do ciclo vs sono da Aline', ordem5, b5);

  // Bloco 6: fase do ciclo vs intimidade
  var contFase = {}; for (var m3 = 0; m3 < ordem5.length; m3++) contFase[ordem5[m3]] = { consumado: 0, naoConsumado: 0 };
  var encontros = window.ST.intimidade.encontros;
  for (var e = 0; e < encontros.length; e++) {
    var fe = calcFaseCiclo(encontros[e].data, window.ST.aline.ciclos);
    if (!fe) continue;
    if (encontros[e].consumado === 'sim') contFase[fe.fase].consumado++; else contFase[fe.fase].naoConsumado++;
  }
  var html6 = '<div class="card"><div class="card-title">Bloco 6 — Fase do ciclo vs intimidade</div><table class="tbl"><tr><th>Fase</th><th>Consumados</th><th>Não consumados</th></tr>';
  for (var m4 = 0; m4 < ordem5.length; m4++) { var cf = contFase[ordem5[m4]]; html6 += '<tr><td>' + ordem5[m4] + '</td><td>' + cf.consumado + '</td><td>' + cf.naoConsumado + '</td></tr>'; }
  html6 += '</table></div>';
  html += html6;

  // Bloco 7: intimidade vs sono da noite seguinte
  var comEncontro = [], semEncontro = [];
  var datasEncontro = {};
  for (var e2 = 0; e2 < encontros.length; e2++) datasEncontro[encontros[e2].data] = true;
  for (var s7 = 0; s7 < sonos.length; s7++) {
    if (datasEncontro[sonos[s7].data]) comEncontro.push(sonos[s7]); else semEncontro.push(sonos[s7]);
  }
  var minsCom = [], minsSem = [];
  for (var x = 0; x < comEncontro.length; x++) if (comEncontro[x].min) minsCom.push(comEncontro[x].min);
  for (var y = 0; y < semEncontro.length; y++) if (semEncontro[y].min) minsSem.push(semEncontro[y].min);
  var html7 = '<div class="card"><div class="card-title">Bloco 7 — Intimidade vs sono</div><table class="tbl"><tr><th>Noite</th><th>Sono médio</th><th>n</th></tr>';
  html7 += '<tr><td>Após encontro íntimo</td><td>' + minParaHoras(media(minsCom)) + '</td><td>' + minsCom.length + '</td></tr>';
  html7 += '<tr><td>Sem encontro</td><td>' + minParaHoras(media(minsSem)) + '</td><td>' + minsSem.length + '</td></tr>';
  html7 += '</table></div>';
  html += html7;

  // Bloco 8: iniciativa por fase
  var inicPorFase = {}; for (var m5 = 0; m5 < ordem5.length; m5++) inicPorFase[ordem5[m5]] = { tarcisio: 0, aline: 0, mutuo: 0 };
  for (var e3 = 0; e3 < encontros.length; e3++) {
    var fe2 = calcFaseCiclo(encontros[e3].data, window.ST.aline.ciclos);
    if (!fe2) continue;
    inicPorFase[fe2.fase][encontros[e3].iniciativa] = (inicPorFase[fe2.fase][encontros[e3].iniciativa] || 0) + 1;
  }
  var html8 = '<div class="card"><div class="card-title">Bloco 8 — Iniciativa por fase do ciclo</div><table class="tbl"><tr><th>Fase</th><th>Tarcísio</th><th>Aline</th><th>Mútuo</th></tr>';
  for (var m6 = 0; m6 < ordem5.length; m6++) { var ip = inicPorFase[ordem5[m6]]; html8 += '<tr><td>' + ordem5[m6] + '</td><td>' + (ip.tarcisio || 0) + '</td><td>' + (ip.aline || 0) + '</td><td>' + (ip.mutuo || 0) + '</td></tr>'; }
  html8 += '</table></div>';
  html += html8;

  html += '<div class="card"><div class="card-title">✨ Análise por IA (opcional)</div>';
  html += '<button class="btn btn-primary" onclick="gerarInsightsIA()">Gerar análise com IA</button>';
  html += '<div id="insightsIAResultado" style="margin-top:12px;"></div></div>';

  html += '<div class="card"><div class="card-title">Histórico de análises</div><div id="insightsHistorico"></div></div>';
  el.innerHTML = html;
  renderHistoricoInsights();
}

function renderHistoricoInsights() {
  var arr = window.ST.insights.slice().sort(function (a, b) { return a.data < b.data ? 1 : -1; });
  var html = '';
  if (arr.length === 0) html = '<div class="li-sub">Nenhuma análise gerada ainda.</div>';
  for (var i = 0; i < arr.length; i++) {
    var r = arr[i];
    html += '<div class="list-item"><div><div class="li-main">' + fmtDate(r.data) + '</div><div class="ai-box">' + esc(r.texto) + '</div></div>';
    html += '<div class="li-actions"><button onclick="excluirInsight(' + r.id + ')">🗑</button></div></div>';
  }
  document.getElementById('insightsHistorico').innerHTML = html;
}

function excluirInsight(id) {
  var arr = window.ST.insights;
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { arr.splice(i, 1); break; }
  window.saveState();
  renderInsights();
}
window.excluirInsight = excluirInsight;

async function gerarInsightsIA() {
  var resEl = document.getElementById('insightsIAResultado');
  resEl.innerHTML = '<div class="li-sub">Gerando análise...</div>';
  try {
    var token = await window._getIdToken();
    var resp = await fetch(window.FUNCTION_URL_INSIGHTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ dados: window.ST })
    });
    var data = await resp.json();
    var texto = data.resultado || 'Não foi possível gerar a análise.';
    resEl.innerHTML = '<div class="ai-box">' + esc(texto) + '</div>';
    window.ST.insights.push({ id: uid(), data: hojeISO(), texto: texto });
    window.saveState();
    renderHistoricoInsights();
  } catch (e) {
    resEl.innerHTML = '<div class="li-sub">Erro ao gerar análise. Verifique a Cloud Function.</div>';
  }
}
window.gerarInsightsIA = gerarInsightsIA;

// ===================== RESUMO IA (semanal) =====================
function renderResumo() {
  var el = document.getElementById('sec-resumo');
  var html = '';
  html += '<div class="card"><div class="card-title">✨ Resumo semanal do casal</div>';
  html += '<div class="card-sub">Gera uma análise da última semana com sugestões práticas</div>';
  html += '<button class="btn btn-primary" onclick="gerarResumoIA()">Gerar resumo da semana</button>';
  html += '<div id="resumoIAResultado" style="margin-top:12px;"></div></div>';
  html += '<div class="card"><div class="card-title">Histórico de resumos</div><div id="resumoHistorico"></div></div>';
  el.innerHTML = html;
  renderHistoricoResumo();
}

function renderHistoricoResumo() {
  var arr = window.ST.resumos.slice().sort(function (a, b) { return a.data < b.data ? 1 : -1; });
  var html = '';
  if (arr.length === 0) html = '<div class="li-sub">Nenhum resumo gerado ainda.</div>';
  for (var i = 0; i < arr.length; i++) {
    var r = arr[i];
    html += '<div class="list-item"><div><div class="li-main">' + fmtDate(r.data) + (r.periodo ? ' — ' + esc(r.periodo) : '') + '</div><div class="ai-box">' + esc(r.texto) + '</div></div>';
    html += '<div class="li-actions"><button onclick="excluirResumo(' + r.id + ')">🗑</button></div></div>';
  }
  document.getElementById('resumoHistorico').innerHTML = html;
}

function excluirResumo(id) {
  var arr = window.ST.resumos;
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { arr.splice(i, 1); break; }
  window.saveState();
  renderResumo();
}
window.excluirResumo = excluirResumo;

async function gerarResumoIA() {
  var resEl = document.getElementById('resumoIAResultado');
  resEl.innerHTML = '<div class="li-sub">Gerando resumo...</div>';
  try {
    var token = await window._getIdToken();
    var resp = await fetch(window.FUNCTION_URL_RESUMO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ dados: window.ST })
    });
    var data = await resp.json();
    var texto = data.resultado || 'Não foi possível gerar o resumo.';
    resEl.innerHTML = '<div class="ai-box">' + esc(texto) + '</div>';
    window.ST.resumos.push({ id: uid(), data: hojeISO(), periodo: 'Últimos 7 dias', texto: texto });
    window.saveState();
    renderHistoricoResumo();
  } catch (e) {
    resEl.innerHTML = '<div class="li-sub">Erro ao gerar resumo. Verifique a Cloud Function.</div>';
  }
}
window.gerarResumoIA = gerarResumoIA;

// ===================== LEITURA DA BÍBLIA =====================
function renderBiblia() {
  var el = document.getElementById('sec-biblia');
  if (!el) return;
  var editando = window._editId.biblia;
  var html = '';
  html += '<div class="card"><div class="card-title">📖 ' + (editando ? 'Editar leitura' : 'Registrar leitura') + '</div>';
  html += '<div class="field"><div class="quem-pick">';
  html += '<button type="button" class="quem-btn q-tarcisio' + pillOn('bibliaQuem', 'tarcisio') + '" onclick="selectSingle(\'bibliaQuem\',\'tarcisio\',this)">👨 Tarcísio</button>';
  html += '<button type="button" class="quem-btn q-aline' + pillOn('bibliaQuem', 'aline') + '" onclick="selectSingle(\'bibliaQuem\',\'aline\',this)">👩 Aline</button>';
  html += '<button type="button" class="quem-btn q-juntos' + pillOn('bibliaQuem', 'casal') + '" onclick="selectSingle(\'bibliaQuem\',\'casal\',this)">👫 Casal</button>';
  html += '<button type="button" class="quem-btn q-juntos' + pillOn('bibliaQuem', 'familia') + '" onclick="selectSingle(\'bibliaQuem\',\'familia\',this)">👨‍👩‍👦‍👦 Família</button>';
  html += '</div></div>';
  html += '<div class="row2">';
  html += '<div class="field"><label>Livro</label><input class="input" id="bibliaLivro" placeholder="Ex: Salmos" value="' + eb('biblia', 'livro') + '"></div>';
  html += '<div class="field"><label>Capítulo(s)</label><input class="input" id="bibliaCapitulo" placeholder="Ex: 23 ou 1-3" value="' + eb('biblia', 'capitulo') + '"></div>';
  html += '</div>';
  html += '<div class="field"><label>Versículo(s) (opcional)</label><input class="input" id="bibliaVersiculo" placeholder="Ex: 1-6" value="' + eb('biblia', 'versiculo') + '"></div>';
  html += '<div class="field"><label>Data</label><input class="input" type="date" id="bibliaData" value="' + eb('biblia', 'data', hojeISO()) + '"></div>';
  html += '<div class="field"><label>Reflexão / observação (opcional)</label><textarea class="input" id="bibliaObs">' + eb('biblia', 'obs') + '</textarea></div>';
  html += '<button class="btn btn-primary" onclick="salvarBiblia()">' + (editando ? 'Salvar edição' : 'Salvar leitura') + '</button>';
  if (editando) html += ' <button class="btn btn-ghost" onclick="cancelarEdicao(\'biblia\')" style="margin-top:8px;">Cancelar edição</button>';
  html += '</div>';
  html += renderStatsBiblia();
  html += '<div class="card"><div class="card-title">Histórico</div><div id="bibliaLista"></div></div>';
  el.innerHTML = html;
  renderListaBiblia();
}

function bibliaQuemLabel(v) {
  if (v === 'tarcisio') return '👨 Tarcísio';
  if (v === 'aline') return '👩 Aline';
  if (v === 'familia') return '👨‍👩‍👦‍👦 Família';
  return '👫 Casal';
}

function renderStatsBiblia() {
  var arr = window.ST.biblia.leituras;
  var cont = { tarcisio: 0, aline: 0, casal: 0, familia: 0 };
  for (var i = 0; i < arr.length; i++) cont[arr[i].quem] = (cont[arr[i].quem] || 0) + 1;
  var html = '<div class="card"><div class="card-title">Estatísticas</div><div class="stat-grid">';
  html += '<div class="stat-box"><div class="num">' + arr.length + '</div><div class="lbl">Total de leituras</div></div>';
  html += '<div class="stat-box"><div class="num">' + (cont.tarcisio || 0) + ' / ' + (cont.aline || 0) + '</div><div class="lbl">Tarcísio / Aline</div></div>';
  html += '</div></div>';
  return html;
}

function renderListaBiblia() {
  var arr = window.ST.biblia.leituras.slice().sort(function (a, b) { return a.data < b.data ? 1 : -1; });
  var html = '';
  if (arr.length === 0) html = '<div class="li-sub">Nenhuma leitura registrada ainda.</div>';
  for (var i = 0; i < arr.length; i++) {
    var reg = arr[i];
    html += '<div class="list-item"><div>';
    html += '<div class="li-main">' + esc(reg.livro) + ' ' + esc(reg.capitulo) + (reg.versiculo ? ':' + esc(reg.versiculo) : '') + ' — ' + bibliaQuemLabel(reg.quem) + '</div>';
    html += '<div class="li-sub">' + fmtDate(reg.data) + '</div>';
    if (reg.obs) html += '<div class="li-sub">' + esc(reg.obs) + '</div>';
    html += '</div><div class="li-actions"><button onclick="editarBiblia(' + reg.id + ')">✏️</button><button onclick="excluirBiblia(' + reg.id + ')">🗑</button></div></div>';
  }
  document.getElementById('bibliaLista').innerHTML = html;
}

function editarBiblia(id) {
  var arr = window.ST.biblia.leituras;
  var reg = null;
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { reg = arr[i]; break; }
  if (!reg) return;
  window._sel = {};
  window._sel.bibliaQuem = reg.quem;
  window._editId.biblia = { id: id };
  window._editBuffer.biblia = { livro: reg.livro, capitulo: reg.capitulo, versiculo: reg.versiculo, data: reg.data, obs: reg.obs };
  renderBiblia();
}
window.editarBiblia = editarBiblia;

function salvarBiblia() {
  var quem = window._sel.bibliaQuem;
  var livro = document.getElementById('bibliaLivro').value;
  if (!quem) { alert('Selecione quem fez a leitura'); return; }
  if (!livro) { alert('Preencha o livro'); return; }
  var editando = window._editId.biblia;
  var reg = {
    id: editando ? editando.id : uid(), quem: quem, livro: livro,
    capitulo: document.getElementById('bibliaCapitulo').value || '',
    versiculo: document.getElementById('bibliaVersiculo').value || '',
    data: document.getElementById('bibliaData').value || hojeISO(),
    obs: document.getElementById('bibliaObs').value || ''
  };
  if (editando) {
    var arrAntigo = window.ST.biblia.leituras;
    for (var i = 0; i < arrAntigo.length; i++) if (arrAntigo[i].id === editando.id) { arrAntigo.splice(i, 1); break; }
    window._editId.biblia = null;
    window._editBuffer.biblia = null;
  }
  window.ST.biblia.leituras.push(reg);
  window.saveState();
  window._sel = {};
  renderBiblia();
}
window.salvarBiblia = salvarBiblia;

function excluirBiblia(id) {
  if (!confirm('Excluir esta leitura?')) return;
  var arr = window.ST.biblia.leituras;
  for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { arr.splice(i, 1); break; }
  window.saveState();
  renderBiblia();
}
window.excluirBiblia = excluirBiblia;

// ===================== REGISTRO DE RERENDER PARA FILTROS DE PERÍODO =====================
registrarRerender('sono', renderSono);
registrarRerender('treino', renderTreino);
registrarRerender('juntos', renderJuntos);
registrarRerender('intimidade', renderIntimidade);
registrarRerender('saude', renderSaude);
registrarRerender('alcool', renderAlcool);

// ===================== REGISTRO DE RERENDER PARA CANCELAR EDIÇÃO =====================
MAPA_RERENDER_MODULO.sono = renderSono;
MAPA_RERENDER_MODULO.treino = renderTreino;
MAPA_RERENDER_MODULO.juntos = renderJuntos;
MAPA_RERENDER_MODULO.intimidade = renderIntimidade;
MAPA_RERENDER_MODULO.saude = renderSaude;
MAPA_RERENDER_MODULO.ciclo = renderCiclo;
MAPA_RERENDER_MODULO.alcool = renderAlcool;
MAPA_RERENDER_MODULO.biblia = renderBiblia;

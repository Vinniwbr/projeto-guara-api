const calendar = document.getElementById('calendar');
const hoje = new Date();
const mesAtual = hoje.getMonth();
const anoAtual = hoje.getFullYear();
const diaAtual = hoje.getDate();
const campoDiaAula = document.getElementById('diaAula');
const campoOrdemAulas = document.getElementById('ordemAulasInput');
const botaoSalvarOrdem = document.getElementById('salvarOrdemAulas');
const painelConfiguracaoAulas = document.getElementById('painelConfiguracaoAulas');

function gerarCalendario(mes, ano) {
    const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const diasTotais = new Date(ano, mes + 1, 0).getDate();
    const primeiroDia = new Date(ano, mes, 1).getDay();

    let html = '<h2 id="mes-ano">' + meses[mes] + ' ' + ano + '</h2>';
    html += '<table>';
    html += '<tr><th>Dom</th><th>Seg</th><th>Ter</th><th>Qua</th><th>Qui</th><th>Sex</th><th>Sab</th></tr>';

    const totalCelulas = primeiroDia + diasTotais;
    const linhasNecessarias = Math.ceil(totalCelulas / 7);

    for (let linha = 0; linha < linhasNecessarias; linha++) {
        html += '<tr>';
        for (let coluna = 0; coluna < 7; coluna++) {
            const indice = linha * 7 + coluna;
            const dia = indice - primeiroDia + 1;

            if (indice < primeiroDia || dia > diasTotais) {
                html += '<td></td>';
            } else {
                const classe = (dia === diaAtual && mes === mesAtual && ano === anoAtual) ? 'hoje' : '';
                html += '<td class="' + classe + '">' + dia + '</td>';
            }
        }
        html += '</tr>';
    }
    html += '</table>';

    if (calendar) {
        calendar.innerHTML = html;
    }
}

gerarCalendario(mesAtual, anoAtual);

function obterPapelUsuario() {
    const token = localStorage.getItem('token');
    if (!token) return 'aluno';

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.papel || 'aluno';
    } catch (error) {
        return 'aluno';
    }
}

function atualizarVisibilidadePainelConfiguracao() {
    const papelUsuario = obterPapelUsuario();
    const podeConfigurar = ['professor', 'diretor'].includes(papelUsuario);

    if (painelConfiguracaoAulas) {
        painelConfiguracaoAulas.style.display = podeConfigurar ? 'block' : 'none';
    }
}
// Função para configuracao de eventos, apenas professores podem adicionar eventos(provas,recuperacoes,atividades,entregas de trabalhos, etc)
// se for um aluno,so mostrar os eventos do dia
function popup(diaSelecionado) {
    const papelUsuario = obterPapelUsuario();

    if (papelUsuario !== 'professor') {
        alert('Apenas professores podem adicionar eventos.');
        return;
    }

    const popup = document.createElement('div');
    popup.classList.add('popup');
    popup.innerHTML = `
        <h3>Eventos</h3>
        <p>Dia selecionado: ${diaSelecionado}</p>
        <input type="text" placeholder="eventos">
        <button id="salvarEvento">Salvar</button>
        <button id="fecharPopup">Fechar</button>
    `;
    document.body.appendChild(popup);
}

document.addEventListener('click', function (event) {
    if (event.target.tagName === 'TD' && event.target.textContent.trim() !== '') {
        const diaSelecionado = event.target.textContent.trim();
        campoDiaAula.value = diaSelecionado;
        Horariodeaulas(diaSelecionado, hoje);
        popularCampoOrdemAulas(diaSelecionado);
        popup(diaSelecionado);
    }
});
let aulas = [
    { dia: 1, hora: '07:10', disciplina: 'fisica' },
    { dia: 1, hora: '08:00', disciplina: 'ingles' },
    { dia: 1, hora: '08:50', disciplina: 'historia' },
    { dia: 1, hora: '09:40', disciplina: 'ingles' },
    { dia: 1, hora: '10:40', disciplina: 'historia'},
    { dia: 1, hora: '11:30', disciplina: 'Fisica' },

    { dia: 2, hora: '07:10', disciplina: 'prog.frontend' },
    { dia: 2, hora: '08:00', disciplina: 'BancoDeDadosII' },
    { dia: 2, hora: '08:50', disciplina: 'prog.frontend' },
    { dia: 2, hora: '09:40', disciplina: 'matematica' },
    { dia: 2, hora: '10:40', disciplina: 'filosofia'},
    { dia: 2, hora: '11:30', disciplina: 'inov.tec.empreend.' },

    { dia: 3, hora: '07:10', disciplina: 'prog.frontend' },
    { dia: 3, hora: '08:00', disciplina: 'BancoDeDadosII' },
    { dia: 3, hora: '08:50', disciplina: 'prog.frontend' },
    { dia: 3, hora: '09:40', disciplina: 'matemnatica' },
    { dia: 3, hora: '10:40', disciplina: 'filosofia'},
    { dia: 3, hora: '11:30', disciplina: 'inov.tec.empreend.' },

    { dia: 4, hora: '07:10', disciplina: 'prog.frontend' },
    { dia: 4, hora: '08:00', disciplina: 'BancoDeDadosII' },
    { dia: 4, hora: '08:50', disciplina: 'prog.frontend' },
    { dia: 4, hora: '09:40', disciplina: 'matemnatica' },
    { dia: 4, hora: '10:40', disciplina: 'filosofia'},
    { dia: 4, hora: '11:30', disciplina: 'inov.tec.empreend.' },




];

function popularCampoOrdemAulas(diaSelecionado) {
    if (!campoOrdemAulas) return;

    const aulasDoDia = aulas.filter(aula => aula.dia === parseInt(diaSelecionado, 10));
    campoOrdemAulas.value = aulasDoDia
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        .map(aula => `${aula.hora} - ${aula.disciplina}`)
        .join('\n');
}

function salvarOrdemAulas() {
    const papelUsuario = obterPapelUsuario();

    if (!['professor', 'diretor'].includes(papelUsuario)) {
        alert('Apenas professores ou diretores podem alterar a ordem das aulas.');
        return;
    }

    const dia = parseInt(campoDiaAula.value, 10);
    const texto = campoOrdemAulas.value.trim();

    if (!dia || !texto) {
        alert('Informe o dia e a ordem das aulas.');
        return;
    }

    aulas = aulas.filter(aula => aula.dia !== dia);

    const novasAulas = texto
        .split('\n')
        .map(linha => linha.trim())
        .filter(Boolean)
        .map((linha, index) => {
            const [hora, ...resto] = linha.split('-');
            return {
                dia,
                hora: hora.trim(),
                disciplina: resto.join('-').trim(),
                ordem: index + 1
            };
        });

    aulas = [...aulas, ...novasAulas];
    Horariodeaulas(dia.toString(), hoje);
    alert('Ordem das aulas salva com sucesso!');
}

function Horariodeaulas(diaSelecionado, hoje) {
    const listaAulas = document.getElementById('listaAulas');
    if (!listaAulas) return;

    listaAulas.innerHTML = `<h2>Ordem de aulas do dia ${diaSelecionado}</h2>`;

    const aulasDoDia = aulas
        .filter(aula => aula.dia === parseInt(diaSelecionado, 10))
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    if (aulasDoDia.length === 0) {
        listaAulas.innerHTML += '<p>Nenhuma aula cadastrada para este dia.</p>';
        return;
    }

    const listaHtml = aulasDoDia.map(aula => `<li>${aula.hora} - ${aula.disciplina}</li>`).join('');
    listaAulas.innerHTML += `<ul>${listaHtml}</ul>`;
}

if (botaoSalvarOrdem) {
    botaoSalvarOrdem.addEventListener('click', salvarOrdemAulas);
}

atualizarVisibilidadePainelConfiguracao();
Horariodeaulas(hoje.getDate().toString(), hoje);
// eu realmente espero que funcione de acordo kkkk
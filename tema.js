/* Aplica o tema escolhido antes da primeira pintura, para a tela não piscar. */
try {
  var temaSalvo = localStorage.getItem('livrocaixa:tema');
  if (temaSalvo === 'claro') document.documentElement.setAttribute('data-theme', 'light');
  if (temaSalvo === 'escuro') document.documentElement.setAttribute('data-theme', 'dark');
} catch (e) { /* armazenamento bloqueado: segue o tema do sistema */ }

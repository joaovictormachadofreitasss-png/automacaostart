// Limpa o cookie de sessão (usado pelo botão "Sair" nas dashboards).

module.exports = async (req, res) => {
  res.setHeader('Set-Cookie', 'lm_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax');
  res.status(200).json({ ok: true });
};

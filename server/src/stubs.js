// TODO: remove when teacher auth lands. This is NOT authentication; any caller can claim any teacher id.
function requireTeacher(req, res, next) {
  const uid = req.get('x-teacher-id');
  if (!uid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = { uid };
  return next();
}

module.exports = { requireTeacher };
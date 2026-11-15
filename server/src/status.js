function toApiStatus(status) {
  return status === 'waiting' ? 'open' : status === 'active' ? 'locked' : status;
}
module.exports = { toApiStatus };

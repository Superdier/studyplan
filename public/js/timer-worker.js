self.onmessage = function(e) {
  if (e.data.command === 'start') {
    setInterval(() => {
      postMessage({command: 'tick'});
    }, 1000);
  }
};
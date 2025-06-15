
const isSubmissionSuccessful = (node) => {
  if(node.nodeType !== Node.ELEMENT_NODE) return false;
  const hasSolvedText = node.textContent && node.textContent.includes('Solved');
  const hasSuccessIcon = node.querySelector('svg.text-message-success') !== null;
  return hasSolvedText && hasSuccessIcon;
}

const getProblemInfo = (element) => {
  if(!element) return null;

  const fullTitle = element.textContent.trim();
  const match = fullTitle.match(/^(\d+)\.\s+(.+)$/);
  return match ? {
    problemNumber: match[1],  
    problemName: match[2]   
  } : null;
};

const sendDataToServer = (problemNumber,problemName) => {
  if(!problemNumber || !problemName) {
    console.warn('Missing problem info. Aborting send.');
    return;
  }

  fetch('http://localhost:3000/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      problemNumber,
      problemName,
    })
  })
  .then(res => res.text())
  .then(data => {
    console.log('Response from server:', data);
  })
  .catch(err => {
    console.error('Failed to send:', err);
  });            
}

const problemObserver = new MutationObserver((mutations,observer) => {
  for(const mutation of mutations) {
    if(mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if(isSubmissionSuccessful(node)) {
          console.log("problem sucessfully solved..");
          const element = document.querySelector('.text-title-large a');
          if(element) {
            const { problemNumber, problemName } = getProblemInfo(element) || {};
            console.log("problemName : ",problemName);
            console.log("problemNumber : ",problemNumber);
            sendDataToServer(problemNumber,problemName)
          }
        }
      });
    }
  }
});

const target = document.getElementById('__next');
if(target) {
  console.log("observing target element...");
  const config = { childList: true, subtree: true };
  problemObserver.observe(target,config);
}
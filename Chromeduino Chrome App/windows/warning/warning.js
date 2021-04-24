$(()=>{
  $('.continue').click(e=>{
    window.onContinue.dispatch();
  });

  $('.install').click(() => {
    chrome.management.installReplacementWebApp();
  })
});
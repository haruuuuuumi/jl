document.querySelectorAll('[data-profile]').forEach(link=>link.addEventListener('click',()=>{const target=document.getElementById(link.dataset.profile);if(target)target.open=true;}));
const linkedProfile=document.getElementById(location.hash.slice(1));if(linkedProfile?.tagName==='DETAILS')linkedProfile.open=true;

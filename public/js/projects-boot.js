document.querySelectorAll('#nav button[data-section="projects"]').forEach(button=>button.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('automation:projects'))));

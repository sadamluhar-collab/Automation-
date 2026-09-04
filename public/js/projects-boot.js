import {activate} from './projects.js';

document.querySelectorAll('#nav button[data-section="projects"]').forEach(button=>button.addEventListener('click',()=>activate()));

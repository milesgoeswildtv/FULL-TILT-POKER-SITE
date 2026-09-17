import React from'react';
import{createRoot}from'react-dom/client';
import App from'./App.jsx';
import LayoutLab from'./LayoutLab.jsx';
import TournamentConfig from'./TournamentConfig.jsx';
import{installSessionRouting}from'./session.js';
import'./fx-runtime.js';
import'./tournament-config.css';
installSessionRouting();
const root=createRoot(document.getElementById('root'));
function render(){const lab=/^#\/layout-lab(?:$|\?)/i.test(location.hash);root.render(lab?<LayoutLab onExit={()=>{location.hash=''}}/>:<><App/><TournamentConfig/></>)}
addEventListener('hashchange',render);
render();

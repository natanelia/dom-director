import * as React from 'react';
import {hydrateRoot} from 'react-dom/client';
import {HydrationApp} from './hydration-app.jsx';
window.hydrationErrors=[];
hydrateRoot(document.querySelector('#root'),<React.StrictMode><HydrationApp/></React.StrictMode>,{onRecoverableError:error=>window.hydrationErrors.push(String(error))});

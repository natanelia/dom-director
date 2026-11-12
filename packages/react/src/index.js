'use client';
import * as React from 'react';
import {createDirector,mountControls,DirectorError} from '@dom-director/core';
import {createReactBindings} from './bindings.js';
export const {useDirector,useDirectorState,useDirectorFrame,useDirectorTarget,DirectorControls,DirectorProvider,useDirectorContext} =
  createReactBindings(React,{createDirector,mountControls,DirectorError});
export {createReactBindings};

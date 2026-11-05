import type * as React from 'react';
import type {Director,DirectorOptions,DirectorState,FrameState,Diagnostic,TargetRegistry,TargetDescriptor,mountControls,createDirector,DirectorError} from '@dom-director/core';
export interface UseDirectorOptions {script?:unknown;options?:Omit<DirectorOptions,'surface'> & {surface?:Omit<DirectorOptions['surface'],'viewport'|'scene'|'overlay'>};onDiagnostic?:(diagnostic:Diagnostic)=>void;}
export interface DirectorBinding {director:Director|null;error:Diagnostic|null;viewportRef:React.RefCallback<HTMLElement>;sceneRef:React.RefCallback<HTMLElement>;overlayRef:React.RefCallback<HTMLElement>;}
export interface UnmountedState {readonly status:'unmounted';readonly sessionId:null;readonly revision:-1;}
export function useDirector(options?:UseDirectorOptions):DirectorBinding;
export function useDirectorState(director:Director|null):DirectorState|UnmountedState;
export function useDirectorFrame(director:Director|null,callback:(frame:FrameState)=>void):void;
export function useDirectorTarget(registry:TargetRegistry|null,id:string,options?:Pick<TargetDescriptor,'label'|'sensitivity'|'dynamic'>):React.RefCallback<HTMLElement>;
export function DirectorControls(props:{director:Director|null;id?:string;className?:string;style?:React.CSSProperties}):React.ReactElement;
export function DirectorProvider(props:{director:Director|null;children?:React.ReactNode}):React.ReactElement;
export function useDirectorContext():Director|null;
export interface ReactBindings {useDirector:typeof useDirector;useDirectorState:typeof useDirectorState;useDirectorFrame:typeof useDirectorFrame;useDirectorTarget:typeof useDirectorTarget;DirectorControls:typeof DirectorControls;DirectorProvider:typeof DirectorProvider;useDirectorContext:typeof useDirectorContext;}
export function createReactBindings(react:typeof React,core:{createDirector:typeof createDirector;mountControls:typeof mountControls;DirectorError?:typeof DirectorError}):ReactBindings;

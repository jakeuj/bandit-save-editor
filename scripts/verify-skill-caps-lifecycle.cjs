#!/usr/bin/env node
'use strict';
// Explicit fail-closed entry. B must prove every effective stage with save / stop / new PID readback.
if(require.main===module){console.error('技藝上限原生生命週期尚未實作；沒有執行遊戲或取得證明。');process.exitCode=1;}

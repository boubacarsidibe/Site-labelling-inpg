import { Component } from '@angular/core';
import { WorkspaceShellComponent } from './workspace-shell.component';
@Component({standalone:true,imports:[WorkspaceShellComponent],template:'<app-workspace-shell [admin]="true"/>'})
export class AdminShellComponent {}

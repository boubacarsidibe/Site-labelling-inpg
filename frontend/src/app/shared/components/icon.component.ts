import { Component, Input } from '@angular/core';

@Component({selector:'app-icon', standalone:true, template:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="paths[name] || paths['shield']"/></svg>`,styles:[`:host{display:inline-flex;width:1.5em;height:1.5em;flex-shrink:0}svg{width:100%;height:100%}`]})
export class IconComponent {
  @Input() name='shield';
  paths:Record<string,string>={
    shield:'M12 3 3.5 6.5V12c0 5 8.5 9 8.5 9s8.5-4 8.5-9V6.5L12 3ZM8 12l3 3 5-6',
    medal:'M12 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM8 16l-2 6 6-3 6 3-2-6M9 10l2 2 4-4',
    leaf:'M20 3C9 3 3 6 3 12a7 7 0 0 0 14 0c0-4 3-9 3-9ZM4 21 15 9',
    people:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-3a7 7 0 0 1 14 0v3H2ZM17 4a4 4 0 0 1 0 7M19 14c3 1 3 4 3 7',
    chart:'M3 21V13h4v8M10 21V8h4v13M17 21V3h4v18',
    building:'M4 21V3h12v18M16 10h5v11M8 7h1M12 7h1M8 11h1M12 11h1M8 15h1M12 15h1M9 21v-3h3v3',
    truck:'M2 5h13v12H2V5ZM15 10h4l3 4v3h-7M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
    flask:'M9 3h6M10 3v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3M7 15h10',
    tool:'M21 3a6 6 0 0 1-7 8L5 20a2 2 0 0 1-3-3l9-9a6 6 0 0 1 8-7l-4 4 3 3 3-5',
    arrow:'M4 12h16M14 6l6 6-6 6',
    chevron:'m9 5 7 7-7 7',
    menu:'M4 6h16M4 12h16M4 18h16',
    check:'m5 12 4 4L19 6'
  };
}

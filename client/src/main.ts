// TODO: quick hack
import '../../shared/data/countries.js';

import { platformBrowser } from '@angular/platform-browser';
import { environment } from './environments/environment';
import { enableProdMode } from '@angular/core';
import { AppModuleNgFactory } from './app/app.module.ngfactory';

if (window['BROWSERSUPPORTED']) {
	if (environment.production) {
		enableProdMode();
	} else {
		Error['stackTraceLimit'] = Infinity;
		require('zone.js/dist/long-stack-trace-zone');
	}

	platformBrowser().bootstrapModuleFactory(AppModuleNgFactory).catch(console.error);
}

export { };
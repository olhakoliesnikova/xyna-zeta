import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { catchError, tap } from 'rxjs/operators';
import { SKIP_API_INTERCEPTOR } from './api.interceptor';
import { AuthenticationOptions, XynaOptions as EnviromentXynaOptions, ZetaProjectOptions as EnviromentZetaProjectOptions, ZetaEnvironment as EnviromentZetaEnvironment} from './zeta-environment.interfaces';
import { RuntimeContext } from './xo/xo-describer';
import { environment } from '@environments/environment';
import { of } from 'rxjs';


class RTC {

    static toRuntimeContext(input: RTC): RuntimeContext {

        if (input.application) {
            return RuntimeContext.fromApplicationVersion(input.application, input.version);
        } else if (input.workspace) {
            return RuntimeContext.fromWorkspace(input.workspace);
        } else {
            return RuntimeContext.undefined;
        }
    }
    application: string;
    version: string;
    workspace: string;
}

class XynaOptions {

    static toXynaOptions(input: XynaOptions): EnviromentXynaOptions {
        const xyna: EnviromentXynaOptions = {
            ...input,
            runtimeContext: RTC.toRuntimeContext(input.runtimeContext)
        }
        return xyna;
    }
    runtimeContext: RTC;
    consistencyCheck: boolean;
}


class ZetaProjectOptions {

    static toZetaProjectOptions(input: ZetaProjectOptions): EnviromentZetaProjectOptions {
        const proj: EnviromentZetaProjectOptions = {
            ...input,
            xo: XynaOptions.toXynaOptions(input.xo)
        }
        if (proj.url.includes('location.origin')) {
            proj.url = proj.url.replace('location.origin', location.origin);
        }
        return proj;
    }
    url: string;
    xo: XynaOptions;
    auth?: AuthenticationOptions;
}


class ZetaEnvironment {

    static toZetaEnvironment(input: ZetaEnvironment): EnviromentZetaEnvironment {
        const env: EnviromentZetaEnvironment = {
            ...input,
            production: environment.production,
            zeta: ZetaProjectOptions.toZetaProjectOptions(input.zeta)
        }
        return env;
    }
    zeta: ZetaProjectOptions;
    [propName: string]: any;
}


@Injectable( {providedIn: 'root'} )
export class ConfigService {

    public config: EnviromentZetaEnvironment;
    private httpClient: HttpClient = inject<HttpClient>(HttpClient);

    initialize() {
        const context: HttpContext = new HttpContext();
        context.set<boolean>(SKIP_API_INTERCEPTOR, true);
        return this.httpClient.get<ZetaEnvironment>('./assets/config.json', { context })
            .pipe(
                catchError(() => {
                    return of(undefined)
                }),
                tap((response) => {
                    if (response) {
                        this.config = ZetaEnvironment.toZetaEnvironment(response);
                    } else {
                        this.config = environment;
                    }
                })
            );
    }
}
/*
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 * Copyright 2023 GIP Xyna GmbH, Germany
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 */
import { XoObjectClass, XoArrayClass, XoProperty, XoObject, XoArray } from '@zeta/api';


@XoObjectClass(null, 'xmcp.auth', 'ExternalCredentialsLoginRequest')
export class XoExternalCredentialsLoginRequest extends XoObject {


    @XoProperty()
    username: string;


    @XoProperty()
    password: string;


    @XoProperty()
    force: boolean;


    @XoProperty()
    domain: string;


    @XoProperty()
    path: string;

    static withDomain(username: string, password: string, domain: string, path: string, force = false): XoExternalCredentialsLoginRequest {
        const request = new XoExternalCredentialsLoginRequest();
        request.username = username;
        request.password = password;
        request.domain = domain;
        request.force = force;
        request.path = path;
        return request;
    }
}

@XoArrayClass(XoExternalCredentialsLoginRequest)
export class XoExternalCredentialsLoginRequestArray extends XoArray<XoExternalCredentialsLoginRequest> {
}

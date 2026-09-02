/*
 * - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 * Copyright 2023 Xyna GmbH, Germany
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
import { XoObject, XoObjectClass, XoProperty } from '../../api';


@XoObjectClass(null, 'xmcp.auth', 'SharedLoginRequest')
export class XoSharedLoginRequest extends XoObject {

    @XoProperty()
    sessionId: string;

    @XoProperty()
    token: string;

    @XoProperty()
    path: string;


    static withCredentials(sessionId: string, token: string, path: string): XoSharedLoginRequest {
        const request = new XoSharedLoginRequest();
        request.sessionId = sessionId;
        request.token = token;
        request.path = path;
        return request;
    }
}

import { execFileSync } from 'child_process';
import path from 'path';

// this uses a service account to get the kube config for our primary cluster
function authKubernetes (): any {
    let scriptPath = path.resolve('src/scripts/auth_kubernetes.sh')
    try {
       return execFileSync(scriptPath)
    } catch (err) {
        console.log("Got error", err)
    }
}

export { 
    authKubernetes
}

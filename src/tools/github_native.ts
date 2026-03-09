import { Octokit } from '@octokit/rest';
import { config } from '../config/env.js';

let octokit: Octokit | null = null;

function getOctokit(): Octokit {
    if (!octokit) {
        if (!process.env.GH_TOKEN) {
            throw new Error("GH_TOKEN is not defined in the environment. Please add it to use GitHub Native tools.");
        }
        octokit = new Octokit({ auth: process.env.GH_TOKEN });
    }
    return octokit;
}

export const githubNativeToolsDef = {
    type: "function",
    function: {
        name: "github_native",
        description: "Ejecuta acciones nativas en GitHub (crear repos, ramas, PRs, leer/escribir archivos) de forma directa a través de la API REST.",
        parameters: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    enum: ["create_repo", "create_branch", "create_pr", "read_file", "write_file", "list_repos"],
                    description: "La acción a realizar."
                },
                repoName: { type: "string", description: "Nombre del repositorio (ej. 'JARVIS'). Requerido para la mayoría de acciones." },
                owner: { type: "string", description: "Dueño del repositorio (ej. 'JuaniSarmiento'). Default: dueño autenticado." },
                branchName: { type: "string", description: "Nombre de la rama. Requerido para create_branch, create_pr, read_file, write_file." },
                baseBranch: { type: "string", description: "Rama base para crear nueva rama o PR (ej. 'main'). Default: 'main'." },
                filePath: { type: "string", description: "Ruta del archivo en el repositorio. Requerido para read_file, write_file." },
                content: { type: "string", description: "Contenido a escribir en el archivo. Requerido para write_file." },
                commitMessage: { type: "string", description: "Mensaje de commit. Requerido para write_file." },
                prTitle: { type: "string", description: "Título del Pull Request. Requerido para create_pr." },
                prBody: { type: "string", description: "Cuerpo/Descripción del Pull Request. Requerido para create_pr." },
                private: { type: "boolean", description: "Si el repo debe ser privado. Default: true. Requerido para create_repo." }
            },
            required: ["action"]
        }
    }
};

export async function executeGithubNative(args: any): Promise<string> {
    const api = getOctokit();
    let authUser = "";
    try {
        const { data } = await api.rest.users.getAuthenticated();
        authUser = data.login;
    } catch (e: any) {
        return `Error de Autenticación con GitHub: ${e.message}`;
    }

    const { action, repoName, owner = authUser, branchName, baseBranch = 'main', filePath, content, commitMessage, prTitle, prBody, private: _private = true } = args;

    try {
        switch (action) {
            case 'create_repo': {
                if (!repoName) return "Falta 'repoName'.";
                const { data } = await api.rest.repos.createForAuthenticatedUser({
                    name: repoName,
                    private: _private,
                    auto_init: true
                });
                return `Repositorio creado exitosamente: ${data.html_url}`;
            }
            case 'create_branch': {
                if (!repoName || !branchName) return "Faltan 'repoName' o 'branchName'.";
                const { data: refData } = await api.rest.git.getRef({
                    owner,
                    repo: repoName,
                    ref: `heads/${baseBranch}`,
                });

                const { data: newRef } = await api.rest.git.createRef({
                    owner,
                    repo: repoName,
                    ref: `refs/heads/${branchName}`,
                    sha: refData.object.sha
                });
                return `Rama '${branchName}' creada desde '${baseBranch}' exitosamente.`;
            }
            case 'create_pr': {
                if (!repoName || !branchName || !prTitle) return "Faltan 'repoName', 'branchName' o 'prTitle'.";
                const { data } = await api.rest.pulls.create({
                    owner,
                    repo: repoName,
                    title: prTitle,
                    head: branchName,
                    base: baseBranch,
                    body: prBody || ""
                });
                return `Pull Request creado exitosamente: ${data.html_url}`;
            }
            case 'read_file': {
                if (!repoName || !filePath) return "Faltan 'repoName' o 'filePath'.";
                const { data } = await api.rest.repos.getContent({
                    owner,
                    repo: repoName,
                    path: filePath,
                    ref: branchName || baseBranch
                });
                if (Array.isArray(data) || data.type !== "file") {
                    return "El path no es un archivo único.";
                }
                const fileContent = Buffer.from(data.content, 'base64').toString('utf-8');
                return fileContent;
            }
            case 'write_file': {
                if (!repoName || !filePath || !content || !commitMessage) return "Faltan parámetros requeridos ('repoName', 'filePath', 'content', 'commitMessage').";
                let sha: string | undefined;
                try {
                    const { data: existingFile } = await api.rest.repos.getContent({
                        owner,
                        repo: repoName,
                        path: filePath,
                        ref: branchName || baseBranch
                    });
                    if (!Array.isArray(existingFile) && existingFile.type === "file") {
                        sha = existingFile.sha;
                    }
                } catch (e) {
                    // Archivo no existe, se creará uno nuevo
                }

                const { data } = await api.rest.repos.createOrUpdateFileContents({
                    owner,
                    repo: repoName,
                    path: filePath,
                    message: commitMessage,
                    content: Buffer.from(content).toString('base64'),
                    branch: branchName || baseBranch,
                    sha
                });

                return `Archivo ${filePath} escrito exitosamente en el commit: ${data.commit.html_url}`;
            }
            case 'list_repos': {
                const { data } = await api.rest.repos.listForAuthenticatedUser({ sort: 'updated', per_page: 10 });
                const repoList = data.map(r => `- ${r.name} (${r.private ? 'Privado' : 'Público'}) - ${r.html_url}`).join('\n');
                return `Repositorios recientes:\n${repoList}`;
            }
            default:
                return `Acción no reconocida: ${action}`;
        }
    } catch (e: any) {
        return `Error en la operación GitHub API: ${e.message}`;
    }
}

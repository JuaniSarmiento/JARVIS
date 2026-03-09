export const installSkillDef = {
    type: "function",
    function: {
        name: "install_skill",
        description: "Crea automáticamente una nueva carpeta de skill en el sistema de Jarvis con instrucciones específicas. Útil para que Jarvis se dote a sí mismo de nuevas capacidades.",
        parameters: {
            type: "object",
            properties: {
                skillName: {
                    type: "string",
                    description: "Nombre de la skill (en minúsculas y con guiones, ej: 'social-media-manager')."
                },
                instructions: {
                    type: "string",
                    description: "Instrucciones detalladas de cómo debe actuar Jarvis cuando esta skill esté activa."
                }
            },
            required: ["skillName", "instructions"],
            additionalProperties: false
        }
    }
};

import * as fs from 'fs';
import * as path from 'path';

export async function executeInstallSkill(args: { skillName: string, instructions: string }): Promise<string> {
    const { skillName, instructions } = args;
    const skillDir = path.join(process.cwd(), 'skills', skillName);
    const skillFile = path.join(skillDir, 'SKILL.md');

    try {
        if (!fs.existsSync(skillDir)) {
            fs.mkdirSync(skillDir, { recursive: true });
        }
        fs.writeFileSync(skillFile, `# Skill: ${skillName}\n\n${instructions}`, 'utf-8');
        return `✅ Skill '${skillName}' instalada correctamente en ${skillFile}. Estará disponible en el próximo arranque o actualización de prompt.`;
    } catch (e: any) {
        return `❌ Error instalando la skill: ${e.message}`;
    }
}

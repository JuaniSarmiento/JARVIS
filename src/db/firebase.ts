import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from '../config/env.js';

interface MessageRow {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    tool_call_id?: string;
    timestamp?: any;
}

class FirebaseMemory {
    private db: admin.firestore.Firestore;

    constructor() {
        try {
            let serviceAccount;
            const envServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

            if (envServiceAccount) {
                serviceAccount = JSON.parse(envServiceAccount);
                console.log('📦 Usando credenciales de Firebase desde variable de entorno');
            } else {
                const serviceAccountPath = join(process.cwd(), config.googleCredentials);
                serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
                console.log('📄 Usando credenciales de Firebase desde archivo local');
            }

            if (!admin.apps.length) {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
            }
            this.db = admin.firestore();
            this.db.settings({ ignoreUndefinedProperties: true });
            console.log('✅ Firebase Firestore inicializado correctamente');
        } catch (error: any) {
            console.error('❌ Error inicializando Firebase:', error.message);
            throw new Error('No se pudo conectar a Firebase. Verifica service-account.json');
        }
    }

    public async addMessage(userId: string, msg: MessageRow) {
        const userDoc = this.db.collection('conversations').doc(userId);
        const messagesCol = userDoc.collection('messages');

        await messagesCol.add({
            ...msg,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    public async getHistory(userId: string, limit: number = 20): Promise<any[]> {
        const messagesCol = this.db.collection('conversations').doc(userId).collection('messages');
        const snapshot = await messagesCol.orderBy('timestamp', 'desc').limit(limit).get();

        const messages = snapshot.docs.map(doc => {
            const data = doc.data();
            const msg: any = {
                role: data.role,
                content: data.content
            };
            if (data.name) msg.name = data.name;
            if (data.tool_call_id) msg.tool_call_id = data.tool_call_id;
            return msg;
        });

        return messages.reverse();
    }

    public async clearHistory(userId: string) {
        const messagesCol = this.db.collection('conversations').doc(userId).collection('messages');
        const snapshot = await messagesCol.get();

        const batch = this.db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
}

export const memoryDb = new FirebaseMemory();

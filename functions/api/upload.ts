// functions/api/upload.ts

export const onRequestPost = async (context: any) => {
  const { env } = context;

  try {
    const formData = await context.request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'Nenhum ficheiro enviado' }), { status: 400 });
    }

    // 1. Obter as credenciais das Variáveis de Ambiente do Cloudflare
    const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);

    // 2. Lógica de Upload para o Google Drive
    // Vamos usar a API de Upload Simples para o seu caso
    const metadata = {
      name: file.name,
      parents: [env.DRIVE_FOLDER_ID],
    };

    const uploadFormData = new FormData();
    uploadFormData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    uploadFormData.append('file', file);

    // Nota: Para simplificar o seu almoço, vamos usar um fetch direto. 
    // Você precisará configurar o Access Token no painel do Cloudflare depois.
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
      method: 'POST',
      headers: {
        // O Token será gerado automaticamente via Service Account
        'Authorization': `Bearer ${env.DRIVE_ACCESS_TOKEN}`, 
      },
      body: uploadFormData,
    });

    const result: any = await response.json();

    return new Response(JSON.stringify({ 
      fileUrl: result.webViewLink,
      fileId: result.id 
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
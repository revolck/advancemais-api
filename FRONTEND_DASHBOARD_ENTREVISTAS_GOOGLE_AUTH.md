# Frontend — Google Auth para Entrevistas Online

## Objetivo

Documentar o ajuste final do dashboard de entrevistas em:

- `/dashboard/empresas/entrevistas`

para que entrevistas `ONLINE` usem a conta Google do próprio usuário criador, enquanto aulas online continuam usando a conta sistêmica.

---

## Escopo da mudança

Esta regra vale apenas para:

- `POST /api/v1/entrevistas`
- `GET /api/v1/entrevistas/overview`

Não altera o fluxo de aulas ao vivo do módulo de cursos.

### Regra de organizador

#### Entrevistas

Quando a entrevista for `ONLINE`:

- o organizador da sala é o usuário logado que criou a entrevista
- o backend usa a conexão Google do próprio criador
- a conta sistêmica não é usada como fallback automático nesse fluxo

Perfis cobertos:

- `ADMIN`
- `MODERADOR`
- `SETOR_DE_VAGAS`
- `EMPRESA`
- `RECRUTADOR`

### Exemplo prático

Se `Ana Setor de Vagas` criar a entrevista online:

- a sala do Meet será criada na conta Google da Ana
- a Ana será a organizadora principal da reunião

Se `Carlos Recrutador` criar a entrevista online:

- a sala será criada na conta Google do Carlos
- ele será o organizador principal da reunião

#### Cursos e aulas ao vivo

O módulo de cursos continua separado:

- aulas ao vivo continuam podendo usar a conta sistêmica institucional

---

## Capabilities no overview

A rota:

- `GET /api/v1/entrevistas/overview`

agora devolve também um bloco de capacidades para a UI decidir o fluxo de criação.

### Resposta adicional esperada

```json
{
  "success": true,
  "data": {
    "capabilities": {
      "canCreate": true,
      "canCreatePresencial": true,
      "canCreateOnline": true,
      "requiresGoogleForOnline": true,
      "google": {
        "connected": true,
        "expired": false,
        "calendarId": "primary",
        "expiraEm": "2026-03-30T22:10:00.000Z",
        "connectEndpoint": "/api/v1/auth/google/connect",
        "disconnectEndpoint": "/api/v1/auth/google/disconnect",
        "statusEndpoint": "/api/v1/auth/google/status"
      }
    }
  }
}
```

### Semântica

- `canCreate`
  - usuário pode abrir o fluxo de marcação
- `canCreatePresencial`
  - usuário pode criar entrevista presencial
- `canCreateOnline`
  - usuário pode criar entrevista online naquele momento
- `requiresGoogleForOnline`
  - a UI deve considerar Google obrigatório para `ONLINE`
- `google.connected`
  - indica se o usuário logado está autenticado com Google Calendar

---

## Recomendação de UX

### Estratégia recomendada

Não esconder o botão inteiro de `Marcar entrevista` apenas por falta de Google.

Motivo:

- `PRESENCIAL` continua válido sem Google

### Fluxo recomendado no frontend

1. usar `capabilities.canCreate` para exibir o botão `Marcar entrevista`
2. usar `capabilities.canCreateOnline` para habilitar a modalidade `ONLINE`
3. se `google.connected = false`:
   - manter `PRESENCIAL` disponível
   - desabilitar `ONLINE`
   - mostrar CTA para conectar Google
4. ao clicar no CTA, chamar:
   - `GET /api/v1/auth/google/connect`
5. redirecionar o usuário para `authUrl`

### Se o produto quiser esconder o botão inteiro

O frontend pode fazer isso usando:

- `capabilities.canCreateOnline`

Mas isso não é a recomendação principal, porque bloquearia também a criação presencial.

---

## Criação online

### Regras finais

Quando `modalidade = ONLINE` e `gerarMeet !== false`:

- o usuário criador precisa estar com Google conectado
- o backend cria a sala com a conta do próprio criador
- o payload volta com `meetUrl` real

### Se o usuário não estiver conectado

O backend retorna:

- `400 INTERVIEW_GOOGLE_NOT_CONNECTED`

Exemplo:

```json
{
  "success": false,
  "code": "INTERVIEW_GOOGLE_NOT_CONNECTED",
  "message": "Para criar entrevista ONLINE, conecte sua conta Google primeiro."
}
```

### Se o Google falhar ao criar a sala

O backend retorna:

- `500 INTERVIEW_MEET_CREATE_ERROR`

Exemplo:

```json
{
  "success": false,
  "code": "INTERVIEW_MEET_CREATE_ERROR",
  "message": "Não foi possível criar a sala do Google Meet para a entrevista."
}
```

---

## Agenda no payload

Para entrevistas online criadas com sucesso, a API pode devolver:

```json
{
  "agenda": {
    "eventoInternoId": "uuid-entrevista",
    "criadoNoSistema": true,
    "provider": "GOOGLE_MEET",
    "organizerSource": "USER_OAUTH",
    "organizerUserId": "uuid-do-usuario-logado",
    "organizerEmail": "setor.vagas@advancemais.com.br"
  }
}
```

### Semântica

- `organizerSource = USER_OAUTH`
  - a reunião foi criada com o Google do usuário logado
- `organizerUserId`
  - usuário da plataforma que organizou a reunião
- `organizerEmail`
  - email do organizador usado na integração

---

## Fluxo recomendado

1. carregar `GET /api/v1/entrevistas/overview`
2. ler `data.capabilities`
3. se `google.connected = false`, oferecer botão `Conectar Google`
4. usar `GET /api/v1/auth/google/connect`
5. depois da conexão concluída, recarregar o overview
6. só permitir submit `ONLINE` quando `canCreateOnline = true`

---

## Checklist frontend

- [ ] Ler `data.capabilities` no overview
- [ ] Exibir `Marcar entrevista` com base em `canCreate`
- [ ] Habilitar `ONLINE` só quando `canCreateOnline = true`
- [ ] Permitir `PRESENCIAL` sem Google
- [ ] Exibir CTA para `GET /api/v1/auth/google/connect` quando `google.connected = false`
- [ ] Tratar `400 INTERVIEW_GOOGLE_NOT_CONNECTED`
- [ ] Tratar `500 INTERVIEW_MEET_CREATE_ERROR`
- [ ] Usar `agenda.organizerSource` apenas como dado informativo da UI

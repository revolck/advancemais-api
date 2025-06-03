export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  usuario: {
    id: string;
    email: string;
    matricula: string;
    tipoUsuario: string;
    nome?: string;
  };
}

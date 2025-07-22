import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../config/prisma";
import { generateToken, generateRefreshToken } from "../utils/auth";

export const criarUsuario = async (req: Request, res: Response) => {
  const {
    email,
    senha,
    nomeCompleto,
    cpf,
    cnpj,
    tipoUsuario,
    role,
    aceitarTermos,
  } = req.body;

  const senhaHash = await bcrypt.hash(senha, 10);

  try {
    const usuario = await prisma.usuario.create({
      data: {
        email,
        senha: senhaHash,
        nomeCompleto,
        cpf,
        cnpj,
        tipoUsuario,
        role,
        aceitarTermos,
      },
    });

    res.status(201).json(usuario);
  } catch (error) {
    res.status(400).json({ message: "Erro ao criar usuário", error });
  }
};

export const loginUsuario = async (req: Request, res: Response) => {
  const { documento, senha } = req.body;

  const isCpf = documento.length === 11;

  const usuario = await prisma.usuario.findUnique({
    where: isCpf ? { cpf: documento } : { cnpj: documento },
  });

  if (!usuario || !(await bcrypt.compare(senha, usuario.senha)))
    return res.status(401).json({ message: "CPF/CNPJ ou senha inválidos" });

  const token = generateToken(usuario.id, usuario.role);
  const refreshToken = generateRefreshToken(usuario.id);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { refreshToken, ultimoLogin: new Date() },
  });

  res.json({ token, refreshToken });
};

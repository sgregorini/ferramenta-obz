import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Usuario } from "../types";

interface LoginProps {
  setUsuario: (usuario: Usuario) => void;
}

export default function Login({ setUsuario }: LoginProps) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    setErro("");

    // Validação na tabela funcionarios
    const { data, error } = await supabase
      .from("funcionarios")
      .select("*")
      .eq("email", email)
      .eq("senha_hash", senha)
      .eq("flag_acesso_sistema", true)
      .eq("ativo", true)
      .single();

    if (error || !data) {
      setErro("Email ou senha inválidos");
    } else {
      // Armazena o usuário autenticado localmente
      localStorage.setItem("usuario", JSON.stringify(data));
      setUsuario(data);
      navigate("/sistema");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background font-akkoLight">
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm text-center">
        <h1 className="text-2xl text-brand-black mb-6 font-akkoMedium">
          Acesse sua conta
        </h1>

        <div className="text-left mb-4">
          <label htmlFor="email" className="block text-sm text-brand-black mb-1">
            E-mail:
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-yellow font-robotoCondensed"
          />
        </div>

        <div className="text-left mb-6">
          <label htmlFor="senha" className="block text-sm text-brand-black mb-1">
            Senha:
          </label>
          <input
            type="password"
            id="senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-yellow font-robotoCondensed"
          />
        </div>

        {erro && <p className="text-red-500 text-sm mb-4">{erro}</p>}

        <button
          onClick={handleLogin}
          className="w-full bg-brand-yellow hover:bg-yellow-300 text-brand-black font-akkoMedium py-2 px-4 rounded-md transition-colors"
        >
          Entrar
        </button>

        <p className="mt-6 text-sm text-gray-500 font-robotoCondensed">
          Esta plataforma é exclusiva para colaboradores.
        </p>
      </div>
    </div>
  );
}

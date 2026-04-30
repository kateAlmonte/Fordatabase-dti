import { useState } from "react"
import { Link } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import logo from "../assets/logo.png"
import { authService } from "../services/supabaseService"

export default function Login({ onLogin, accounts = [] }) {
    const [showPassword, setShowPassword] = useState(false)
    const [formData, setFormData] = useState({
        username: "",
        password: "",
    })
    const [error, setError] = useState("")

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!formData.username.trim() || !formData.password.trim()) {
            setError("Please enter your username and password.")
            return
        }

        setError("")
        
        try {
            // Resolve the input to an email address.
            // - If the user typed something with "@", treat it as an email directly.
            // - Otherwise, look up the email in the profiles table by username
            //   via a SECURITY DEFINER RPC (so it works while the user is still
            //   logged out and RLS would normally block reads).
            const rawInput = formData.username.trim()
            let email = rawInput

            if (!rawInput.includes("@")) {
                try {
                    const lookedUpEmail = await authService.getEmailByUsername(rawInput)
                    if (!lookedUpEmail) {
                        setError("Invalid username or password.")
                        return
                    }
                    email = lookedUpEmail
                } catch (rpcError) {
                    setError("Invalid username or password.")
                    console.error("Username lookup failed:", rpcError)
                    return
                }
            }

            const { user } = await authService.signIn(email, formData.password)
            const profile = await authService.getProfile(user.id)

            onLogin({
                id: user.id,
                username: profile.username,
                email: profile.email,
                fullName: profile.full_name,
                role: profile.role,
                status: profile.status
            })
        } catch (error) {
            setError("Invalid username or password.")
            console.error('Login error:', error)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-r from-[#014b4c] via-[#0a5d60] to-[#4f9597] px-6 py-8">
            <div className="w-full max-w-[550px] rounded-[2rem] bg-white px-8 py-10 shadow-xl md:px-12 md:py-12">
                <div className="mb-8 text-center">
                    <div className="mb-5 flex justify-center">
                        <div className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700">
                            <img src={logo} alt="DTI RAPID Growth Logo" className="h-20 w-auto object-contain"></img>
                        </div>
                    </div>

                    <h1 className="text-4xl font-bold leading-tight text-[#062f35]">
                        Welcome!
                    </h1>
                    <p className="mt-2 text-lg text-slate-500">
                        Please input your details below
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            Username
                        </label>
                        <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="enc_user or adm_admin"
                            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-slate-300"
                        />
                        <p className="mt-2 text-xs text-slate-500">
                            Frontend prototype login only allows usernames that exist in the current account list.
                        </p>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            Password
                        </label>

                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="At least 8 characters"
                                className="w-full rounded-2xl border border-slate-300 px-4 py-3 pr-12 text-sm outline-none transition focus:ring-2 focus:ring-slate-300"
                            />

                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-500"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div className="text-right">
                        <Link
                            to="/forgot-password"
                            className="text-sm font-medium text-[#2a6b71] transition hover:underline"
                        >
                            Forgot Password?
                        </Link>
                    </div>

                    {error && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full rounded-full bg-[#233f8f] px-4 py-3 text-base font-semibold text-white shadow-md transition hover:opacity-90"
                    >
                        SIGN IN
                    </button>
                </form>

                <p className="mt-10 text-center text-sm leading-relaxed text-[#3d6f73]">
                    @Xavier University – Ateneo de Cagayan
                    <br />
                    In Fulfillment of SLP and ITCC project
                </p>
            </div>
        </div>
    )
}

"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function OAuthRedirect() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash
      if (hash && hash.includes("access_token")) {
        // Move hash to root for main app to pick up
        window.location.href = "/" + hash
      } else {
        // No token, redirect home
        router.replace("/")
      }
    }
  }, [router])

  return <div>Redirecting...</div>
}

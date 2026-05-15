"use client"

import { Calculator } from "lucide-react"
import { ProfitCalculator } from "@/components/profit-calculator"

export default function ProfitCalculatorPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">商品登録・利益計算</h1>
            <p className="text-sm text-muted-foreground">
              仕入コストとeBay販売条件から利益を自動計算
            </p>
          </div>
        </div>

        {/* Calculator */}
        <ProfitCalculator />
      </div>
    </div>
  )
}

"use client";

import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { round } from "echarts/types/src/util/number.js";

interface ChartProps {
  trendData: any[]; // { period: string, volume: number, lead_count: number, converted_count: number }
}

export default function AnalyticsCharts({ trendData }: ChartProps) {
  const volumeChartRef = useRef<HTMLDivElement>(null);
  const leadsChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!volumeChartRef.current || !leadsChartRef.current || !trendData || trendData.length === 0) return;

    // 1. Initialize Inflow Volume Line Chart
    const volChart = echarts.init(volumeChartRef.current);
    const periods = trendData.map((d) => d.period);
    const volumes = trendData.map((d) => d.volume);

    volChart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "#ffffff",
        borderColor: "#cbd5e1",
        borderWidth: 1,
        rounded: '2xl',
        shadowColor: "rgba(0, 0, 0, 0.1)",
        shadowBlur: 10,
        textStyle: { color: "#1e293b" },
        formatter: (params: any) => {
          const p = params[0];
          return `<div class="p-1 text-left">
            <span class="text-[10px] text-slate-400 font-bold block uppercase">${p.name}</span>
            <span class="text-xs font-semibold text-slate-800 mt-1 block">Amount: <b class="text-[#8E288D]">ETB ${p.value.toLocaleString()}</b></span>
          </div>`;
        }
      },
      grid: { left: "4%", right: "4%", bottom: "12%", top: "8%", containLabel: true },
      xAxis: {
        type: "category",
        data: periods,
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { color: "#64748b", fontSize: 10, margin: 12 },
        boundaryGap: false
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#f1f5f9", width: 1 } },
        axisLabel: { 
          color: "#64748b",
          fontSize: 10,
          formatter: (value: number) => `$${(value / 1000).toFixed(0)}k`
        }
      },
      dataZoom: [
        { type: "inside", start: 0, end: 100 }, 
        { 
          type: "slider", 
          bottom: 0, 
          height: 16,
          borderColor: "transparent",
          fillerColor: "rgba(99, 102, 241, 0.08)",
          handleStyle: { color: "#8E288D" },
          textStyle: { color: "#64748b", fontSize: 9 }
        }
      ],
      series: [
        {
          name: "FCY Volume",
          data: volumes,
          type: "line",
          smooth: true,
          showSymbol: false,
          lineStyle: {
            width: 4,
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "#8E288D" },
              { offset: 0.5, color: "#CFB53B" },
              { offset: 1, color: "#1A1A1A" }
            ])
          },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(142,40,141,0.30)" },
              { offset: 0.5, color: "rgba(207,181,59,0.15)" },
              { offset: 1, color: "rgba(0,0,0,0.02)" }
            ])
          },
        }
      ]
    });

    // 2. Initialize Lead Generation vs Conversion Bar Chart
    const lChart = echarts.init(leadsChartRef.current);
    const leads = trendData.map((d) => d.lead_count);
    const conversions = trendData.map((d) => d.converted_count);

    lChart.setOption({
      backgroundColor: "transparent",
      legend: {
        data: ["Leads Generated", "Leads Converted"],
        textStyle: { color: "#475569", fontSize: 11 },
        top: 0,
        right: 10,
        icon: "circle"
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#ffffff",
        borderColor: "#cbd5e1",
        rounded: '2xl',
        shadowColor: "rgba(0, 0, 0, 0.1)",
        shadowBlur: 10,
        borderWidth: 1,
        textStyle: { color: "#1e293b" }
      },
      grid: { left: "4%", right: "4%", bottom: "12%", top: "15%", containLabel: true },
      xAxis: {
        type: "category",
        data: periods,
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisLabel: { color: "#64748b", fontSize: 10, margin: 12 }
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
        axisLabel: { color: "#64748b", fontSize: 10 }
      },
      dataZoom: [
        { type: "inside", start: 0, end: 100 },
        {
          type: "slider",
          bottom: 0,
          height: 16,
          borderColor: "transparent",
          fillerColor: "rgba(99, 102, 241, 0.08)",
          handleStyle: { color: "#8E288D" },
          textStyle: { color: "#64748b", fontSize: 9 }
        }
      ],
      series: [
        {
          name: "Leads Generated",
          data: leads,
          type: "bar",
          itemStyle: { 
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "#CFB53B" },
              // { offset: 1, color: "#8E288D" }
            ]),
            borderRadius: [6, 6, 0, 0]
          }
        },
        {
          name: "Leads Converted",
          data: conversions,
          type: "bar",
          itemStyle: { 
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "#8E288D" },
              // { offset: 1, color: "#CFB53B" }
            ]),
            borderRadius: [6, 6, 0, 0]
          }
        }
      ]
    });

    const handleResize = () => {
      volChart.resize();
      lChart.resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      volChart.dispose();
      lChart.dispose();
    };
  }, [trendData]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* Volume Trend Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col">
        <div className="mb-6 flex justify-center">
            <h3 className="text-slate-500 font-bold text-base text-center">Historical FCY Volume Inflow</h3>
        </div>
        <div ref={volumeChartRef} className="h-80 w-full"></div>
      </div>

      {/* Leads Generation vs Conversion Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-md shadow-slate-100 flex flex-col">
        <div className="mb-6 flex justify-center">
          <h3 className="text-slate-500 font-bold text-base text-center">
            Monthly leads generated vs leads converted to accounts/loans
          </h3>
        </div>

        <div ref={leadsChartRef} className="h-80 w-full"></div>
      </div>
    </div>
  );
}

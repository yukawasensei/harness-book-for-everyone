# 核心术语

## Model

根据输入上下文预测并生成 token 的模型。模型本身不会直接读取文件或执行命令。

## Tool

提供给模型的函数说明。模型可以请求调用工具，但真正执行由 Harness 完成。

## Agent loop

模型输出工具调用，Harness 执行并把结果放回上下文，模型再继续判断，直到返回最终答案或触发终止条件。

## Harness

围绕模型的工程外壳，包括 system prompt、工具、循环、状态、权限、超时、重试、上下文管理、日志、评测和界面。

## SFT

Supervised Fine-Tuning，用输入与理想输出样本训练模型行为。

## LoRA / QLoRA

LoRA 只训练少量适配参数；QLoRA 以低比特加载底模来节省训练显存。

## Baseline

改动之前的可重复评测结果。没有 baseline，就无法判断 Prompt、Harness 或微调是否真的改善了模型。

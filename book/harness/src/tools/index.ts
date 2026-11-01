// 本书 harness 可注册的自定义工具；是否真的开放，由 case 的 allowed_tools 决定。
import { helloTool } from "./hello.js";
import { slowTool } from "./slow.js";

export const CUSTOM_TOOLS = [helloTool, slowTool];

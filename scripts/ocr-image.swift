// 使用 macOS Vision 框架对图片做中文 OCR
// 输出：每行 "y<TAB>x<TAB>text"，便于后续按坐标还原表格行
//
// 编译运行：swift scripts/ocr-image.swift <图片路径>
// 说明：Vision 的 VNRecognizeTextRequest 支持 zh-Hans，适合中文表格截图。

import Foundation
import Vision
import CoreImage

func ocr(path: String) {
    guard let ciImage = CIImage(contentsOf: URL(fileURLWithPath: path)) else {
        FileHandle.standardError.write("无法读取图片：\(path)\n".data(using: .utf8)!)
        exit(1)
    }

    let request = VNRecognizeTextRequest { req, err in
        if let err = err {
            FileHandle.standardError.write("OCR 错误：\(err)\n".data(using: .utf8)!)
            exit(2)
        }
        guard let observations = req.results as? [VNRecognizedTextObservation] else { return }

        var out: [(Double, Double, String)] = []
        for obs in observations {
            guard let top = obs.topCandidates(1).first else { continue }
            let text = top.string.trimmingCharacters(in: .whitespacesAndNewlines)
            if text.isEmpty { continue }
            // boundingBox 原点在左下角，y 越大越靠上
            let bb = obs.boundingBox
            out.append((Double(bb.midY), Double(bb.minX), text))
        }

        // 按 y 从大到小（从上到下）排序，同一行内按 x 从左到右
        out.sort { a, b in
            if abs(a.0 - b.0) > 0.004 { return a.0 > b.0 }
            return a.1 < b.1
        }

        var buf = ""
        for (y, x, t) in out {
            buf += String(format: "%.6f\t%.6f\t%@\n", y, x, t)
        }
        print(buf, terminator: "")
    }

    // 中文优先，其次英文数字
    request.recognitionLanguages = ["zh-Hans", "en-US"]
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])
    do {
        try handler.perform([request])
    } catch {
        FileHandle.standardError.write("执行失败：\(error)\n".data(using: .utf8)!)
        exit(3)
    }
}

let args = CommandLine.arguments
if args.count < 2 {
    FileHandle.standardError.write("用法：swift scripts/ocr-image.swift <图片路径>\n".data(using: .utf8)!)
    exit(1)
}
ocr(path: args[1])

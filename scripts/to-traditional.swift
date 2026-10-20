import Foundation
let text = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8)!
print(text.applyingTransform(StringTransform("Hans-Hant"), reverse: false) ?? text)

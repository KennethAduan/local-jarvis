fn main() {
    #[cfg(windows)]
    {
        // sherpa-onnx-sys stages its matching DLLs into Cargo's profile directory.
        // Copy them to deps too, where Cargo runs test executables.
        let out = std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap());
        let profile = std::env::var("PROFILE").unwrap();
        let dir = out
            .ancestors()
            .find(|p| p.file_name().is_some_and(|n| n == profile.as_str()))
            .unwrap();
        let deps = dir.join("deps");
        std::fs::create_dir_all(&deps).unwrap();
        for name in [
            "onnxruntime.dll",
            "onnxruntime_providers_shared.dll",
            "sherpa-onnx-c-api.dll",
            "sherpa-onnx-cxx-api.dll",
        ] {
            std::fs::copy(dir.join(name), deps.join(name))
                .expect("stage matching Kokoro runtime for tests");
        }
    }
}

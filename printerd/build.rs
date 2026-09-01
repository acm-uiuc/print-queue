fn main() {
    println!("cargo:rerun-if-changed=../schema/device.capnp");
    capnpc::CompilerCommand::new()
        .src_prefix("../schema")
        .file("../schema/device.capnp")
        .run()
        .expect("failed to compile device.capnp");
}

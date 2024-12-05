#[link(name = "sl", kind="static")]
extern {
    fn hello_world();
}

fn main() {
    unsafe {
        hello_world();
    };
}
